const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { AppEnv } = require('./env');

class Cache {
  constructor(cwd, cacheDir = process.env.TS_CACHE_DIR) {
    this.cwd = cwd;

    if (!cacheDir) {
      const name = cwd.replace(/[\\\/:]/g, '_');
      cacheDir = path.join(os.tmpdir(), name);
    }

    this.cacheDir = cacheDir;
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

  removeEntry(full) {
    fs.unlinkSync(this.toEntryName(full));
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
        if (os.platform().startsWith('win')) {
          execSync(`del /S ${this.cacheDir}`, { shell: true });
        } else {
          execSync(`rm -rf ${this.cacheDir}`, { shell: true });
        }
        console.debug(`Deleted ${this.cacheDir}`);
      } catch (e) {
        console.error('Failed in deleting');
      }
    }
  }

  fromEntryName(cached) {
    return path.join(this.cwd, cached.replace(this.cacheDir, '').replace(/~/g, path.sep).replace(/@ts$/, '.ts'));
  }

  toEntryName(full) {
    return path.join(this.cacheDir, full.replace(this.cwd, '').replace(/^[\\\/]/, '').replace(/[\/\\]+/g, '~').replace(/.ts$/, '@ts'));
  }
}

class $AppCache extends Cache {
  init() {
    super.init();

    for (const f of fs.readdirSync(this.cacheDir)) {
      const full = this.fromEntryName(f);
      try {
        const cacheStat = this.statEntry(full);
        const fullStat = fs.statSync(full);

        if (cacheStat.ctimeMs < fullStat.ctimeMs || cacheStat.mtimeMs < fullStat.mtimeMs || cacheStat.atimeMs < fullStat.atimeMs) {
          this.removeEntry(full);
        }
      } catch (e) {
        console.debug('Cannot read', e.message);
        // Cannot remove missing file
      }
    }
  }
}

exports.Cache = Cache;

exports.AppCache = new $AppCache(AppEnv.cwd);