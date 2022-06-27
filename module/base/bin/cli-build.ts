import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

import { BuildUtil } from './lib';

/**
 * Command line support for building the code with the ability to
 * control the output target.
 */
export class BaseBuildPlugin extends BasePlugin {

  name = 'build';

  override async build() { }

  getOptions() {
    return {
      output: this.option({ desc: 'Output directory', completion: true }),
      quiet: this.boolOption({ desc: 'Quiet operation' })
    };
  }

  async action() {
    if (this.cmd.output) {
      process.env.TRV_CACHE = this.cmd.output;
    }

    const { AppCache } = await import('@travetto/boot');
    const path = this.cmd.output ?? AppCache.cacheDir;

    try {
      await BuildUtil.build(process.env as Record<string, string>);

      if (!this.cmd.quiet) {
        console!.log(color`${{ success: 'Successfully' }} wrote to ${{ path }}`);
      }
    } catch (err) {
      console.error(color`${{ failure: 'Failed' }} to compile to ${{ path }}`, err);
      process.exit(1);
    }
  }
}