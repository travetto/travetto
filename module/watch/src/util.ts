import { path } from '@travetto/common';

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
        cb(e);
      });
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
  }
}