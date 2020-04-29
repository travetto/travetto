import * as fs from 'fs';

import { FileCache } from './cache';
import { FsUtil } from './fs-util';
import { EnvUtil } from './env';

/**
 * Cache for all app related files, primarily typescript transpilation output
 */
class $AppCache extends FileCache {
  constructor() {
    super(EnvUtil.get('TRV_CACHE', `${FsUtil.cwd}/.trv_cache`));
  }

  init() {
    super.init();

    try {
      // Ensure we have access before trying to delete
      fs.accessSync(this.cacheDir, fs.constants.W_OK);
    } catch (e) {
      return; // Skip trying to delete;
    }

    for (const f of fs.readdirSync(this.cacheDir)) {
      const full = this.fromEntryName(f);
      try {
        this.removeExpiredEntry(full);
      } catch (e) {
        // Only care if it's source, otherwise might be dynamically cached data without backing file
        if (full.endsWith('.ts') || full.endsWith('.js')) {
          // Cannot remove file, source is missing
          console.debug('Cannot read', e.message);
        }
      }
    }
  }

  fromEntryName(cached: string) {
    return FsUtil.toTS(
      FsUtil.joinUnix(FsUtil.cwd,
        super.fromEntryName(cached)
          .replace(/\._\./g, 'node_modules/@travetto')
      )
    );
  }

  toEntryName(full: string) {
    return FsUtil.toJS(
      super.toEntryName(full.replace(FsUtil.cwd, '')
        .replace(/node_modules\/@travetto/g, '._.')
      )
    );
  }


  reset() {
    for (const k of Object.keys(require.cache)) {
      if (k.includes('@travetto')) { // If a travetto module
        delete require.cache[k];
      }
    }
  }
}

export const AppCache = new $AppCache();