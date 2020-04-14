import * as os from 'os';
import * as fs from 'fs';
import { FsUtil } from './fs-util';
import { EnvUtil } from './env';

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
      const peTcd = EnvUtil.get('trv_cache_dir');
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
      .replace(/\btrv[.]/g, '@travetto/')
      .replace(/^[.]/, 'node_modules/')
      .replace(/~/g, '/')
    )
      .replace(/[.]js$/g, '.ts');
  }

  toEntryName(full: string) {
    const out = FsUtil.joinUnix(this.cacheDir,
      FsUtil.toUnix(full)
        .replace(this.cwd, '')
        .replace(/^[\/]+/, '')
        .replace(/^node_modules\//, '.')
        .replace('@travetto/', 'trv.')
        .replace(/[\/]+/g, '~')
    )
      .replace(/[.]ts$/g, '.js');
    return out;
  }
}