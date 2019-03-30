import * as fs from 'fs';
import { FsUtil } from './fs-util';

function isOlder(cacheStat: fs.Stats, fullStat: fs.Stats) {
  return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
}

export class FileCache {
  cwd: string;
  cacheDir: string;
  cache: { [key: string]: fs.Stats } = {};

  constructor(cwd: string, cacheDir: string = FsUtil.cacheDir) {
    this.cwd = FsUtil.toUnix(cwd || FsUtil.cwd);
    this.cacheDir = FsUtil.toUnix(cacheDir || FsUtil.cacheDir);
  }

  init() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir);
    }
  }

  writeEntry(full: string, contents: string | Buffer) {
    fs.writeFileSync(this.toEntryName(full), contents);
    this.statEntry(full);
  }

  readEntry(full: string) {
    return fs.readFileSync(this.toEntryName(full)).toString();
  }

  removeExpiredEntry(full: string, force = false) {
    if (this.hasEntry(full)) {
      if (force || isOlder(this.statEntry(full), fs.statSync(full))) {
        fs.unlinkSync(this.toEntryName(full));
      }
      this.removeEntry(full);
    }
  }

  removeEntry(full: string) {
    delete this.cache[full];
  }

  hasEntry(full: string) {
    return !!this.cache[full] || fs.existsSync(this.toEntryName(full));
  }

  statEntry(full: string) {
    if (!this.cache[full]) {
      const stat = fs.statSync(this.toEntryName(full));
      this.cache[full] = stat;
    }
    return this.cache[full];
  }

  clear() {
    if (this.cacheDir) {
      try {
        FsUtil.unlinkRecursiveSync(this.cacheDir);
        console.debug(`Deleted ${this.cacheDir}`);
        this.cache = {}; // Clear it out
      } catch (e) {
        console.error('Failed in deleting');
      }
    }
  }

  fromEntryName(cached: string) {
    return FsUtil.joinUnix(this.cwd, cached
      .replace(this.cacheDir, '')
      .replace(/~/g, '/')
    )
      .replace(/[.]js$/g, '.ts');
  }

  toEntryName(full: string) {
    const out = FsUtil.joinUnix(this.cacheDir,
      FsUtil.toUnix(full)
        .replace(this.cwd, '')
        .replace(/^[\/]+/, '')
        .replace(/[\/]+/g, '~')
    )
      .replace(/[.]ts$/g, '.js');
    return out;
  }
}

class $AppCache extends FileCache {
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

export const AppCache = new $AppCache(FsUtil.cwd, FsUtil.cacheDir);