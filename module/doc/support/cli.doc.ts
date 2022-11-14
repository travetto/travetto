import * as fs from 'fs/promises';

import { path } from '@travetto/common';
import { ModuleIndex, PhaseManager } from '@travetto/boot';
import { Env } from '@travetto/base';
import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli';

import { RenderUtil } from '../src/render/util';

type Options = {
  input: OptionConfig<string>;
  output: ListOptionConfig<string>;
  format: OptionConfig<string>;
  watch: OptionConfig<boolean>;
};

/**
 * Command line support for generating module docs.
 */
export class DocCommand extends CliCommand<Options> {
  name = 'doc';

  getOptions(): Options {
    return {
      input: this.option({ desc: 'Input File', def: 'index.ts' }),
      output: this.listOption({ desc: 'Output files' }),
      format: this.option({ desc: 'Format', def: 'md' }),
      watch: this.boolOption({ desc: 'Watch' })
    };
  }

  async envInit(): Promise<void> {
    Env.define({
      debug: '0',
      set: {
        TRV_CONSOLE_WIDTH: '140',
        TRV_CLI_JSON_IPC: '',
        TRV_COLOR: '0',
        TRV_LOG_PLAIN: '1'
      }
    });
  }

  async action(): Promise<void> {
    console.error(process.env);

    // Standard compile
    await PhaseManager.run('init');

    const docFile = path.resolve(this.cmd.input);

    // If specifying output
    if (this.cmd.output.length) {
      const write = async (): Promise<void> => {
        RenderUtil.purge(docFile);
        for (const out of this.cmd.output) {
          const fmt = path.extname(out) ?? this.cmd.format;
          const finalName = path.resolve(out);
          const result = await RenderUtil.render(docFile, fmt);
          await fs.writeFile(finalName, result, 'utf8');
        }
      };

      if (this.cmd.watch) {
        if (ModuleIndex.hasModule('@travetto/watch')) {
          const { WatchUtil } = await import('@travetto/watch');
          await WatchUtil.watchFile(docFile, write, true);
        } else {
          console.error('@travetto/watch must be installed to use watch functionality');
        }
      } else {
        try {
          await write();
        } catch (err) {
          console.error(path.cwd(), err);
          process.exit(1);
        }
      }
    } else {
      console.log(await RenderUtil.render(docFile, this.cmd.format));
    }
  }
}