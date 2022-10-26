import * as path from 'path';

import { Util } from '@travetto/base';
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
    new Watcher(__source.folder, { interval: 250, exclude: { testDir: () => false, testFile: f => f === file } })
      .on('all', async e => {
        if (unload) {
          await DynamicLoader.unload(path.resolve(file).__posix);
        }
        cb(e);
      });
    await Util.wait('1d');
  }
}