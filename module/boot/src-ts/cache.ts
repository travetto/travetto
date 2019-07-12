import * as os from 'os';
import * as fs from 'fs';
import { FsUtil } from './fs-util';

function isOlder(cacheStat: fs.Stats, fullStat: fs.Stats) {
  return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
}

export class FileCache {
  private cache: Record<string, fs.Stats> = {};

  readonly cwd: string;
  readonly cacheDir: string;

  constructor(cwd: string, cacheDir?: string) {
    this.cache = {};
    this.cwd = FsUtil.toUnix(cwd || FsUtil.cwd);

    if (!cacheDir) {
      const peTcd = process.env.TRV_CACHE_DIR;
      const defCache = FsUtil.joinUnix(os.tmpdir(), FsUtil.cwd.replace(/[\/:]/g, '_'));
      cacheDir = peTcd === 'PID' ? `${defCache}_${process.pid}` : (peTcd && peTcd !== '-' ? peTcd : defCache);
    }

    this.cacheDir = FsUtil.toUnix(cacheDir);
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

  clear(quiet = false) {
    if (this.cacheDir) {
      try {
        FsUtil.unlinkRecursiveSync(this.cacheDir);
        if (!quiet) {
          console.debug(`Deleted ${this.cacheDir}`);
        }
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