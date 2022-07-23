import * as fs from 'fs/promises';

import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { FileCache, PathUtil } from '@travetto/boot';

/**
 * `npx trv clean`
 *
 * Allows for cleaning of the cache dire
 */
export class BaseCleanPlugin extends BasePlugin {

  name = 'clean';

  override async build(): Promise<void> { }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  getOptions() {
    return { quiet: this.boolOption({ desc: 'Quiet operation' }) };
  }

  async action(): Promise<void> {
    for (const el of await fs.readdir(PathUtil.cwd)) {
      if (el.startsWith('.trv') && (await fs.stat(el)).isDirectory()) {
        const cache = new FileCache(el);
        try {
          cache.clear(true);
          if (!this.cmd.quiet) {
            console!.log(color`${{ success: 'Successfully' }} deleted temp dir ${{ path: cache.cacheDir }}`);
          }
        } catch {
          console!.error(color`${{ failure: 'Failed' }} to delete temp dir ${{ path: cache.cacheDir }}`);
        }
      }
    }
  }
}
