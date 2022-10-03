import { Util } from '@travetto/base';
import { PathUtil } from '@travetto/boot';
import { TranspileManager } from '@travetto/boot/src/internal/transpile';

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
    new Watcher(__dirname, { interval: 250, exclude: { testDir: () => false, testFile: f => f === file } })
      .on('all', e => {
        if (unload) {
          TranspileManager.unload(PathUtil.resolveUnix(file));
        }
        cb(e);
      });
    await Util.wait('1d');
  }
}