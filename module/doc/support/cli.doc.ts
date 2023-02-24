import fs from 'fs/promises';

import { PackageUtil, path, RootIndex, watchFolders } from '@travetto/manifest';
import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli';

import { RenderUtil } from '../src/render/util';

type Options = {
  input: OptionConfig<string>;
  outputs: ListOptionConfig<string>;
  watch: OptionConfig<boolean>;
};

/**
 * Command line support for generating module docs.
 */
export class DocCommand extends CliCommand<Options> {
  name = 'doc';

  getOptions(): Options {
    return {
      input: this.option({ desc: 'Input File', def: 'DOC.ts' }),
      outputs: this.listOption({ desc: 'Outputs', def: [] }),
      watch: this.boolOption({ desc: 'Watch' })
    };
  }

  envInit(): GlobalEnvConfig {
    return {
      debug: false,
      set: {
        TRV_CONSOLE_WIDTH: 140,
        TRV_CLI_IPC: '',
        FORCE_COLOR: 0,
        TRV_LOG_PLAIN: true
      }
    };
  }

  async action(): Promise<void> {
    const docFile = path.resolve(this.cmd.input);
    if (!(await fs.stat(docFile).catch(() => false))) {
      console.error(`The input ${this.cmd.input} does not exist`);
      return this.exit(1);
    }

    if (this.cmd.outputs.length === 0) {
      const workspacePkg = PackageUtil.readPackage(RootIndex.manifest.workspacePath);
      this.cmd.outputs = workspacePkg.travetto?.docOutputs ?? ['README.md'];
    }

    const outputs = this.cmd.outputs.map(output => output.includes('.') ? [path.extname(output).substring(1), path.resolve(output)] : [output, null] as const);

    // If specifying output
    const write = async (): Promise<void> => {
      RenderUtil.purge(docFile);
      for (const [fmt, out] of outputs) {
        const result = await RenderUtil.render(docFile, fmt);
        if (out) {
          const finalName = path.resolve(out);
          await fs.writeFile(finalName, result, 'utf8');
        } else {
          process.stdout.write(result);
        }
      }
    };

    if (this.cmd.watch) {
      await watchFolders([path.dirname(docFile)], () => setTimeout(write, 250), {
        filter: ev => ev.action === 'update' && ev.file === docFile
      });
      await write();
    } else {
      try {
        await write();
        console.log(`Wrote docs for ${this.cmd.input}`);
      } catch (err) {
        console.error(err);
        this.exit(1);
      }
    }
  }
}