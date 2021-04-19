import { TimeUtil } from '@travetto/base/src/internal/time';
import { PathUtil } from '@travetto/boot';
import { ModuleManager } from '@travetto/boot/src/internal/module';

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
  static async watchFile(file: string, cb: (ev: unknown) => void, unload = false) {
    new Watcher(__dirname, { interval: 250, exclude: { testDir: () => false, testFile: f => f === file } })
      .on('all', e => {
        if (unload) {
          ModuleManager.unload(PathUtil.resolveUnix(file));
        }
        cb(e);
      });
    await new Promise(r => setTimeout(r, TimeUtil.toMillis(1, 'd')));
  }
}