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

  /**
   * Directory to cache into
   */
  constructor(cacheDir: string) {
    this.cacheDir = FsUtil.toUnix(cacheDir);
  }

  init() {
    FsUtil.mkdirpSync(this.cacheDir);
  }

  /**
   * Write contents to disk
   * @param local Local location
   * @param contents Contents to write
   */
  writeEntry(local: string, contents: string | Buffer) {
    fs.writeFileSync(this.toEntryName(local), contents);
    this.statEntry(local);
  }

  /**
   * Read entry from disk
   * @param local Read the entry given the local name
   */
  readEntry(local: string) {
    return fs.readFileSync(this.toEntryName(local), 'utf-8');
  }

  /**
   * Delete expired entries
   * @param full The local location
   * @param force Should deletion be force
   */
  removeExpiredEntry(local: string, force = false) {
    if (this.hasEntry(local)) {
      try {
        if (force || isOlder(this.statEntry(local), fs.statSync(local))) {
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
    return FsUtil.toUnix(entry)
      .replace(this.cacheDir, '')
      .replace(/~/g, '/')
      .replace(/\/\/+/g, '/')
      .replace(/^./g, 'node_modules/@travetto');
  }

  /**
   * Map the original file name to the cache file space
   * @param local Local path
   */
  toEntryName(local: string) {
    return FsUtil.joinUnix(this.cacheDir, local
      .replace(FsUtil.cwd, '')
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
    const name = FsUtil.toUnix(local);
    let content: string;
    if (force || !this.hasEntry(name)) {
      this.writeEntry(name, content = create());
    } else {
      content = this.readEntry(name);
    }
    return content;
  }
}