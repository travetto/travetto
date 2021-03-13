import * as fs from 'fs';

import { EnvUtil } from './env';
import { FsUtil } from './fs';
import { PathUtil } from './path';

/**
 * Standard file cache, with output file name normalization and truncation
 */
export class FileCache {

  static isOlder(cacheStat: fs.Stats, fullStat: fs.Stats) {
    return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
  }

  private cache = new Map<string, fs.Stats>();

  readonly cacheDir: string;

  /**
   * Directory to cache into
   */
  constructor(cacheDir?: string) {
    this.cacheDir = PathUtil.resolveUnix(cacheDir ?? EnvUtil.get('TRV_CACHE', '.trv_cache'));
  }

  /**
   * Purge all expired data
   */
  private purgeExpired() {
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
   * Initialize the cache behavior
   */
  init(purgeExpired = false) {
    if (!EnvUtil.isReadonly()) {
      FsUtil.mkdirpSync(this.cacheDir);

      try {
        // Ensure we have access before trying to delete
        fs.accessSync(this.cacheDir, fs.constants.W_OK);
      } catch (e) {
        throw new Error(`Unable to write to cache directory: ${this.cacheDir}`);
      }
      if (purgeExpired) {
        this.purgeExpired();
      }
    }
  }

  /**
   * Write contents to disk
   * @param local Local location
   * @param contents Contents to write
   */
  writeEntry(local: string, contents: string) {
    fs.writeFileSync(this.toEntryName(local), contents, 'utf8');
    this.statEntry(local);
  }

  /**
   * Read entry from disk
   * @param local Read the entry given the local name
   */
  readEntry(local: string): string {
    return fs.readFileSync(this.toEntryName(local), 'utf8');
  }

  /**
   * Read optional entry from disk, undefined if missing
   * @param local Read the entry given the local name
   */
  readOptionalEntry(local: string): string | undefined {
    return this.hasEntry(local) ? this.readEntry(local) : undefined;
  }

  /**
   * Delete expired entries
   * @param full The local location
   * @param force Should deletion be force
   */
  removeExpiredEntry(local: string, force = false) {
    if (this.hasEntry(local)) {
      try {
        if (force || FileCache.isOlder(this.statEntry(local), fs.statSync(local))) {
          fs.unlinkSync(this.toEntryName(local));
        }
      } catch (e) {
        if (!e.message.includes('ENOENT')) {
          throw e;
        }
      }
      this.removeEntry(local);
    }
  }

  /**
   * Delete entry
   * @param local The location to delete
   */
  removeEntry(local: string) {
    this.cache.delete(local);
  }

  /**
   * Checks to see if a file has been loaded or if it's available on disk
   * @param local The location to verify
   */
  hasEntry(local: string) {
    return this.cache.has(local) || FsUtil.existsSync(this.toEntryName(local));
  }

  /**
   * Retrieve fs.Stats of the associated path
   * @param local The location to stat
   */
  statEntry(local: string) {
    if (!this.cache.has(local)) {
      const stat = fs.statSync(this.toEntryName(local));
      this.cache.set(local, stat);
    }
    return this.cache.get(local)!;
  }

  /**
   * Clear cache
   * @param quiet Should the clear produce output
   */
  clear(quiet = false) {
    if (this.cacheDir) {
      try {
        FsUtil.unlinkRecursiveSync(this.cacheDir);
        if (!quiet) {
          console.debug('Deleted', { cacheDir: this.cacheDir });
        }
        this.cache.clear(); // Clear it out
      } catch (e) {
        console.error('Failed in deleting');
      }
    }
  }

  /**
   * Map entry file name to the original source
   * @param entry The entry path
   */
  fromEntryName(entry: string) {
    return PathUtil.toUnix(entry)
      .replace(this.cacheDir, '')
      .replace(/~/g, '/')
      .replace(/\/\/+/g, '/')
      .replace(/^[.]/g, 'node_modules/@travetto')
      .replace(/node_modules\/@travetto/, a => process.env.TRV_DEV || a);
  }

  /**
   * Map the original file name to the cache file space
   * @param local Local path
   */
  toEntryName(local: string) {
    return PathUtil.joinUnix(this.cacheDir, local
      .replace(PathUtil.cwd, '')
      .replace(process.env.TRV_DEV || '#', '.')
      .replace(/node_modules\/@travetto/g, '.')
      .replace(/^\//, '')
      .replace(/\/+/g, '~')
    );
  }

  /**
   * Get or set a value (from the create function) if not in the cache
   * @param local The local location
   * @param create The method to execute if the entry is not found
   * @param force Should create be executed always
   */
  getOrSet(local: string, create: () => string, force = false) {
    const name = PathUtil.toUnix(local);
    let content: string;
    if (force || !this.hasEntry(name)) {
      this.writeEntry(name, content = create());
    } else {
      content = this.readEntry(name);
    }
    return content;
  }
}

export const AppCache = new FileCache();