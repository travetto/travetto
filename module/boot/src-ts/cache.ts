import * as fs from 'fs';
import { FsUtil } from './fs-util';

function isOlder(cacheStat: fs.Stats, fullStat: fs.Stats) {
  return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
}

/**
 * Standard file cache, with output file name normalization and truncation
 */
// TODO: Document
export class FileCache {
  private cache = new Map<string, fs.Stats>();

  readonly cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = FsUtil.toUnix(cacheDir);
  }

  init() {
    FsUtil.mkdirpSync(this.cacheDir);
  }

  writeEntry(full: string, contents: string | Buffer) {
    fs.writeFileSync(this.toEntryName(full), contents);
    this.statEntry(full);
  }

  readEntry(full: string) {
    return fs.readFileSync(this.toEntryName(full), 'utf-8');
  }

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

  removeEntry(full: string) {
    this.cache.delete(full);
  }

  hasEntry(full: string) {
    return this.cache.has(full) || fs.existsSync(this.toEntryName(full));
  }

  statEntry(full: string) {
    if (!this.cache.has(full)) {
      const stat = fs.statSync(this.toEntryName(full));
      this.cache.set(full, stat);
    }
    return this.cache.get(full)!;
  }

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

  fromEntryName(cached: string) {
    return FsUtil.toUnix(cached)
      .replace(this.cacheDir, '')
      .replace(/~/g, '/')
      .replace(/\/\/+/g, '/');
  }

  toEntryName(full: string) {
    return FsUtil.joinUnix(this.cacheDir, full
      .replace(/^\//, '')
      .replace(/\/+/g, '~')
    );
  }

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