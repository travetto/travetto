import * as commander from 'commander';

import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

import { BuildUtil } from './lib';

/**
 * Command line support for building the code with the ability to
 * control the output target.
 */
export class BaseBuildPlugin extends BasePlugin {

  name = 'build';
  build = undefined;

  init(cmd: commander.Command) {
    return cmd
      .option('-c, --clean', 'Indicates if the cache dir should be cleaned')
      .option('-o, --output <output>', 'Output directory')
      .option('-q, --quiet', 'Quiet operation');
  }

  async action() {
    if (this._cmd.output) {
      process.env.TRV_CACHE = this._cmd.output;
    }

    const { AppCache } = await import('@travetto/boot');
    const path = this._cmd.output ?? AppCache.cacheDir;

    if (this._cmd.clean) {
      await AppCache.clear(true);
      console.log(color`${{ success: 'Succesfully' }} deleted ${{ path }} `);
    }

    try {
      await BuildUtil.build(process.env as Record<string, string>);

      if (!this._cmd.quiet) {
        console!.log(color`${{ success: 'Successfully' }} wrote to ${{ path }}`);
      }
    } catch (err) {
      console.error(color`${{ failure: 'Failed' }} to compile to ${{ path }}`, err);
      process.exit(1);
    }
  }

  complete() {
    return {
      '': ['--clean', '--quiet', '--runtime-dir', '--output']
    };
  }
}