import * as fs from 'fs';
import { FsUtil } from './fs';

function isOlder(cacheStat: fs.Stats, fullStat: fs.Stats) {
  return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
}

/**
 * Standard file cache, with output file name normalization and truncation
 */
export class FileCache {
  private cache = new Map<string, fs.Stats>();

  readonly cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = FsUtil.toUnix(cacheDir);
  }

  init() {
    FsUtil.mkdirpSync(this.cacheDir);
  }

  /**
   * Write contents to disk
   */
  writeEntry(full: string, contents: string | Buffer) {
    fs.writeFileSync(this.toEntryName(full), contents);
    this.statEntry(full);
  }

  /**
   * Read entry from disk
   */
  readEntry(full: string) {
    return fs.readFileSync(this.toEntryName(full), 'utf-8');
  }

  /**
   * Delete expired entries
   */
  removeExpiredEntry(full: string, force = false) {
    if (this.hasEntry(full)) {
      try {
        if (force || isOlder(this.statEntry(full), fs.statSync(full))) {
          fs.unlinkSync(this.toEntryName(full));
        }
      } catch (e) {
        if (!e.message.includes('ENOENT')) {
          throw e;
        }
      }
      this.removeEntry(full);
    }
  }

  /**
   * Delete entry
   */
  removeEntry(full: string) {
    this.cache.delete(full);
  }

  /**
   * Checks to see if a file has been loaded or if it's available on disk
   */
  hasEntry(full: string) {
    return this.cache.has(full) || fs.existsSync(this.toEntryName(full));
  }

  /**
   * Retrieve fs.Stats of the associated path
   */
  statEntry(full: string) {
    if (!this.cache.has(full)) {
      const stat = fs.statSync(this.toEntryName(full));
      this.cache.set(full, stat);
    }
    return this.cache.get(full)!;
  }

  /**
   * Clear cache
   */
  clear(quiet = false) {
    if (this.cacheDir) {
      try {
        FsUtil.unlinkRecursiveSync(this.cacheDir);
        if (!quiet) {
          console.debug(`Deleted ${this.cacheDir}`);
        }
        this.cache.clear(); // Clear it out
      } catch (e) {
        console.error('Failed in deleting');
      }
    }
  }

  /**
   * Map cached file name to the original source
   */
  fromEntryName(cached: string) {
    return FsUtil.toUnix(cached)
      .replace(this.cacheDir, '')
      .replace(/~/g, '/')
      .replace(/\/\/+/g, '/');
  }

  /**
   * Map the original file name to the cache file space
   */
  toEntryName(full: string) {
    return FsUtil.joinUnix(this.cacheDir, full
      .replace(/^\//, '')
      .replace(/\/+/g, '~')
    );
  }

  /**
   * Get or set a value (from the create function) if not in the cache
   */
  getOrSet(key: string, create: () => string, force = false) {
    const name = FsUtil.toUnix(key);
    let content: string;
    if (force || !this.hasEntry(name)) {
      this.writeEntry(name, content = create());
    } else {
      content = this.readEntry(name);
    }
    return content;
  }
}