import * as path from '@travetto/path';
import { TimeUtil } from '@travetto/base';
import { DynamicLoader } from '@travetto/boot/src/internal/dynamic-loader';

import { Watcher } from './watcher';

/**
 * Shared Utilities
 */
export class WatchUtil {
  /**
   * Watch a file
   * @param file
   * @param cb
   */
  static async watchFile(file: string, cb: (ev: unknown) => void, unload = false): Promise<void> {
    new Watcher(path.cwd(), { interval: 250, exclude: { testDir: () => false, testFile: f => f === file } })
      .on('all', async e => {
        if (unload) {
          await DynamicLoader.unload(path.resolve(file));
        }
        cb(e);
      });
    await TimeUtil.wait('1d');
  }
}