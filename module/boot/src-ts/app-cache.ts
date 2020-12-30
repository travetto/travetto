import * as fs from 'fs';

import { FileCache } from './cache';
import { FsUtil } from './fs';
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

    if (EnvUtil.isReadonly()) {
      return; // Do not clean cache in readonly mode
    }

    for (const f of fs.readdirSync(this.cacheDir)) {
      const full = this.fromEntryName(f);
      try {
        this.removeExpiredEntry(full);
      } catch (e) {
        // Only care if it's source, otherwise might be dynamically cached data without backing file
        if (full.endsWith('.ts') || full.endsWith('.js')) {
          // Cannot remove file, source is missing
          console.warn('Cannot read', { error: e });
        }
      }
    }
  }

  /**
   * Convert from cached entry name to local file
   * @param cached Cached entry location
   */
  fromEntryName(cached: string) {
    return FsUtil.resolveUnix(
      super.fromEntryName(cached)
        .replace(/_._/g, 'node_modules/@travetto')
        .replace('node_modules/@travetto', `${process.env.TRV_DEV}/module`) // @line-if $TRV_DEV
    ).replace(/[.]js$/, '.ts');
  }

  /**
   * Convert from local entry name to cache
   * @param local Local entry location
   */
  toEntryName(local: string) {
    return super.toEntryName(local.replace(FsUtil.cwd, '')
      .replace(`${process.env.TRV_DEV}/module`, 'node_modules/@travetto') // @line-if $TRV_DEV
      .replace(/node_modules\/@travetto/g, '_._')
    ).replace(/[.]ts$/, '.js');
  }

  /**
   * Clear the cache
   */
  reset() {
    for (const k of Object.keys(require.cache)) {
      if (k.includes('@travetto')) { // If a travetto module
        delete require.cache[k];
      }
    }
  }
}

export const AppCache = new $AppCache();