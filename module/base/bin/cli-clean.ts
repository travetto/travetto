import * as commander from 'commander';
import * as fs from 'fs';

import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { FileCache, PathUtil } from '@travetto/boot/src';

/**
 * `npx trv clean`
 *
 * Allows for cleaning of the cache dire
 */
export class BootCleanPlugin extends BasePlugin {
  name = 'clean';
  build = undefined;

  init(cmd: commander.Command) {
    return cmd.option('-q, --quiet', 'Quiet operation');
  }

  async action() {
    for (const el of await fs.promises.readdir(PathUtil.cwd)) {
      if (el.startsWith('.trv') && (await fs.promises.stat(el)).isDirectory()) {
        const cache = new FileCache(el);
        try {
          if (!this._cmd.quiet) {
            console!.log(color`${{ success: 'Successfully' }} deleted temp dir ${{ path: cache.cacheDir }}`);
          }
        } catch (e) {
          console!.error(color`${{ failure: 'Failed' }} to delete temp dir ${{ path: cache.cacheDir }}`);
        }
      }
    }
  }

  complete() {
    return { '': ['--quiet'] };
  }
}
