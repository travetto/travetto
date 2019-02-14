//@ts-check
const fs = require('fs');
const { FsUtil } = require('./fs-util');

function isOlder(cacheStat, fullStat) {
  return cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs;
}

class FileCache {
  constructor(cwd, cacheDir) {
    this.cwd = FsUtil.toUnix(cwd || FsUtil.cwd);
    this.cacheDir = FsUtil.toUnix(cacheDir || FsUtil.cacheDir);
    this.cache = {};
  }

  init() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir);
    }
  }

  writeEntry(full, contents) {
    fs.writeFileSync(this.toEntryName(full), contents);
    this.statEntry(full);
  }

  readEntry(full) {
    return fs.readFileSync(this.toEntryName(full)).toString();
  }

  removeExpiredEntry(full, force = false) {
    if (this.hasEntry(full)) {
      if (force || isOlder(this.statEntry(full), fs.statSync(full))) {
        fs.unlinkSync(this.toEntryName(full));
      }
      this.removeEntry(full);
    }
  }

  removeEntry(full) {
    delete this.cache[full];
  }

  hasEntry(full) {
    return !!this.cache[full] || fs.existsSync(this.toEntryName(full));
  }

  statEntry(full) {
    if (!this.cache[full]) {
      const stat = fs.statSync(this.toEntryName(full));
      this.cache[full] = stat;
    }
    return this.cache[full];
  }

  clear() {
    if (this.cacheDir) {
      try {
        FsUtil.unlinkDirSync(this.cacheDir);
        console.debug(`Deleted ${this.cacheDir}`);
      } catch (e) {
        console.error('Failed in deleting');
      }
    }
  }

  fromEntryName(cached) {
    return FsUtil.joinUnix(this.cwd, cached
        .replace(this.cacheDir, '')
        .replace(/~/g, '/')
      )
      .replace(/[.]js$/g, '.ts');
  }

  toEntryName(full) {
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
  constructor(cwd, cacheDir) {
    super(cwd, cacheDir);
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

exports.FileCache = FileCache;

exports.AppCache = new $AppCache(FsUtil.cwd, FsUtil.cacheDir);