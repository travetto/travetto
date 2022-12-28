import fs from 'fs/promises';

import { path } from '@travetto/manifest';
import { WatchUtil, ExecUtil, GlobalEnvConfig } from '@travetto/base';
import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli';

import { RenderUtil } from '../src/render/util';

type Options = {
  input: OptionConfig<string>;
  outputBase: OptionConfig<string>;
  formats: ListOptionConfig<string>;
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
      input: this.option({ desc: 'Input File', def: 'README.ts' }),
      outputBase: this.option({ desc: 'Output Base', def: '' }),
      formats: this.listOption({ desc: 'Formats', def: [] }),
      watch: this.boolOption({ desc: 'Watch' }),
      stdout: this.boolOption({ desc: 'Write to stdout', def: false })
    };
  }

  envInit(): GlobalEnvConfig {
    return {
      debug: false,
      set: {
        TRV_CONSOLE_WIDTH: 140,
        TRV_CLI_JSON_IPC: '',
        NO_COLOR: true,
        TRV_LOG_PLAIN: true
      }
    };
  }

  async action(): Promise<void> {
    const docFile = path.resolve(this.cmd.input);
    if (!(await fs.stat(docFile).catch(() => false))) {
      return ExecUtil.returnResponse(1, `The input ${this.cmd.input} does not exist`);
    }

    if (this.cmd.formats.length === 0) {
      this.cmd.formats.push('md', 'html');
    }
    const outputBase = this.cmd.outputBase || path.basename(this.cmd.input).replace(/[.]ts$/, '');
    const outputs = this.cmd.formats.map(fmt => [fmt, path.resolve(`${outputBase}.${fmt}`)]);

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
        ExecUtil.returnResponse(0, `Wrote docs for ${this.cmd.input}`);
      } catch (err) {
        ExecUtil.returnResponse(1, `${err}`);
      }
    }
  }
}