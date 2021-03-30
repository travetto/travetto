import * as commander from 'commander';

import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

import { BuildUtil } from './lib';

type Config = {
  output?: string;
  clean?: boolean;
  quiet?: boolean;
};

/**
 * Command line support for building the code with the ability to
 * control the output target.
 */
export class BaseBuildPlugin extends BasePlugin<Config> {

  name = 'build';
  build = undefined;

  init(cmd: commander.Command) {
    return cmd
      .option('-c, --clean', 'Indicates if the cache dir should be cleaned')
      .option('-o, --output <output>', 'Output directory')
      .option('-q, --quiet', 'Quiet operation');
  }

  async action() {
    if (this.opts.output) {
      process.env.TRV_CACHE = this.opts.output;
    }

    const { AppCache } = await import('@travetto/boot');
    const path = this.opts.output ?? AppCache.cacheDir;

    if (this.opts.clean) {
      await AppCache.clear(true);
      console.log(color`${{ success: 'Succesfully' }} deleted ${{ path }} `);
    }

    try {
      await BuildUtil.build(process.env as Record<string, string>);

      if (!this.opts.quiet) {
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