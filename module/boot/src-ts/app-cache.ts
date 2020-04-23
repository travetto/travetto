import * as fs from 'fs';

import { FileCache } from './cache';
import { FsUtil } from './fs-util';
import { EnvUtil } from './env';

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
}

export const AppCache = new $AppCache();