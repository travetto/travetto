import * as commander from 'commander';
import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * `npx trv clean`
 *
 * Allows for cleaning of the cache dire
 */
export class BootCleanPlugin extends BasePlugin {
  name = 'clean';

  init(cmd: commander.Command) {
    return cmd.option('-q, --quiet', 'Quiet operation');
  }

  async action() {
    const { AppCache } = await import('../src/cache');
    try {
      AppCache.clear(true);

      if (!this._cmd.quiet) {
        console!.log(color`${{ success: 'Successfully' }} deleted temp dir ${{ path: AppCache.cacheDir }}`);
      }
    } catch (e) {
      console!.error(color`${{ failure: 'Failed' }} to delete temp dir ${{ path: AppCache.cacheDir }}`);
    }
  }

  complete() {
    return { '': ['--quiet'] };
  }
}
