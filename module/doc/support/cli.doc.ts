import fs from 'fs/promises';

import { PackageUtil, path, RootIndex } from '@travetto/manifest';
import { WatchUtil, ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli';

import { RenderUtil } from '../src/render/util';

type Options = {
  input: OptionConfig<string>;
  outputs: ListOptionConfig<string>;
  watch: OptionConfig<boolean>;
  stdout: OptionConfig<boolean>;
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
      watch: this.boolOption({ desc: 'Watch' }),
      stdout: this.boolOption({ desc: 'Write to stdout', def: false })
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
      ExecUtil.returnResponse(`The input ${this.cmd.input} does not exist`, true);
      return this.exit(1);
    }

    if (this.cmd.outputs.length === 0) {
      const workspacePkg = PackageUtil.readPackage(RootIndex.manifest.workspacePath);
      this.cmd.outputs = workspacePkg.travetto?.docOutputs ?? ['README.md'];
    }

    const outputs = this.cmd.outputs.map(output => [path.extname(output).substring(1), path.resolve(output)]);

    // If specifying output
    const write = async (): Promise<void> => {
      RenderUtil.purge(docFile);
      for (const [fmt, out] of outputs) {
        const finalName = path.resolve(out);
        const result = await RenderUtil.render(docFile, fmt);
        if (this.cmd.stdout) {
          process.stdout.write(result);
        } else {
          await fs.writeFile(finalName, result, 'utf8');
        }
      }
    };

    if (this.cmd.watch) {
      await WatchUtil.watchFile(docFile, write);
    } else {
      try {
        await write();
        ExecUtil.returnResponse(`Wrote docs for ${this.cmd.input}`);
        return this.exit(0);
      } catch (err) {
        ExecUtil.returnResponse(`${err}`, true);
        return this.exit(1);
      }
    }
  }
}