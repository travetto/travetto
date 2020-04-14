import * as fs from 'fs';
import { FsUtil } from './fs-util';
import { EnvUtil } from './env';

function isOlder(cacheStat: fs.Stats, fullStat: fs.Stats) {
  return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
}

export class FileCache {
  private cache = new Map<string, fs.Stats>();

  readonly cwd: string;
  readonly cacheDir: string;

  constructor(cwd: string, cacheDir?: string) {
    this.cwd = FsUtil.toUnix(cwd || FsUtil.cwd);
    this.cacheDir = FsUtil.toUnix(cacheDir ?? EnvUtil.get('trv_cache_dir') ?? `${this.cwd}/.trv_cache`);
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
    return FsUtil.joinUnix(this.cwd, cached
      .replace(this.cacheDir, '')
      .replace(/^[.]/, 'node_modules/@travetto/')
      .replace(/~/g, '/')
    )
      .replace(/[.]js$/, '.ts');
  }

  toEntryName(full: string) {
    const out = FsUtil.joinUnix(this.cacheDir,
      FsUtil.toUnix(full)
        .replace(`${this.cwd}/`, '')
        .replace(/^.*node_modules\/@travetto\//, '.')
        .replace(/[/]+/g, '~')
    )
      .replace(/[.]ts$/, '.js');
    return out;
  }
}