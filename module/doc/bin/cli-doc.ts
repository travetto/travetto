import * as path from 'path';
import * as fs from 'fs';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { EnvInit } from '@travetto/base/bin/init';
import { PathUtil } from '@travetto/boot';

/**
 * Command line support for generating module docs.
 */
export class DocPlugin extends BasePlugin {
  name = 'doc';

  getOptions() {
    return {
      input: this.option({ desc: 'Input File', def: 'doc.ts' }),
      output: this.listOption({ desc: 'Output files' }),
      format: this.option({ desc: 'Format', def: 'md' }),
      watch: this.boolOption({ desc: 'Watch' })
    };
  }

  async envInit() {
    EnvInit.init({
      debug: '0',
      append: {
        TRV_SRC_LOCAL: 'doc',
        TRV_RESOURCES: 'doc/resources'
      },
      set: {
        TRV_CONSOLE_WIDTH: '140',
        TRV_COLOR: '0',
        TRV_LOG_PLAIN: '1'
      }
    });
  }

  async action() {
    const { PhaseManager } = await import('@travetto/base');
    // Standard compile
    await PhaseManager.run('init');

    const { RenderUtil } = await import('../src/render/util');

    const docFile = PathUtil.resolveUnix(this.cmd.input);

    // If specifying output
    if (this.cmd.output.length) {
      const write = async () => {
        RenderUtil.purge(docFile);
        for (const out of this.cmd.output) {
          const fmt = path.extname(out) ?? this.cmd.format;
          const finalName = await PathUtil.resolveUnix(out);
          const result = await RenderUtil.render(docFile, fmt);
          await fs.promises.writeFile(finalName, result, 'utf8');
        }
      };

      if (this.cmd.watch) {
        const { WatchUtil } = await import('@travetto/watch');
        await WatchUtil.watchFile(docFile, write, true);
      } else {
        try {
          await write();
        } catch (err) {
          console.error(PathUtil.cwd, err);
          process.exit(1);
        }
      }
    } else {
      console.log(await RenderUtil.render(docFile, this.cmd.format));
    }
  }
}