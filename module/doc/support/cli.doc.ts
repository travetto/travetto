import * as path from 'path';
import * as fs from 'fs/promises';

import { PhaseManager } from '@travetto/boot';
import { EnvInit } from '@travetto/base/support/bin/env';
import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli';

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
      input: this.option({ desc: 'Input File', def: 'doc.ts' }),
      output: this.listOption({ desc: 'Output files' }),
      format: this.option({ desc: 'Format', def: 'md' }),
      watch: this.boolOption({ desc: 'Watch' })
    };
  }

  async envInit(): Promise<void> {
    EnvInit.init({
      debug: '0',
      append: {
        TRV_SRC_LOCAL: 'doc',
        TRV_RESOURCES: 'doc/resources'
      },
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

    const { RenderUtil } = await import('../src/render/util');

    const docFile = path.resolve(this.cmd.input).__posix;

    // If specifying output
    if (this.cmd.output.length) {
      const write = async (): Promise<void> => {
        RenderUtil.purge(docFile);
        for (const out of this.cmd.output) {
          const fmt = path.extname(out) ?? this.cmd.format;
          const finalName = path.resolve(out).__posix;
          const result = await RenderUtil.render(docFile, fmt);
          await fs.writeFile(finalName, result, 'utf8');
        }
      };

      if (this.cmd.watch) {
        const { WatchUtil } = await import('@travetto/watch');
        await WatchUtil.watchFile(docFile, write, true);
      } else {
        try {
          await write();
        } catch (err) {
          console.error(process.cwd().__posix, err);
          process.exit(1);
        }
      }
    } else {
      console.log(await RenderUtil.render(docFile, this.cmd.format));
    }
  }
}