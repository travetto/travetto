const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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

    for (const f of fs.readdirSync(this.cacheDir)) {
      const full = this.fromEntryName(f);
      const cacheFull = path.join(this.cacheDir, f);
      try {
        const stat = this.statEntry(cacheFull);
        const fullStat = fs.statSync(full);
        if (stat.ctimeMs < fullStat.ctimeMs || stat.mtimeMs < fullStat.mtimeMs || stat.atime < fullStat.mtime) {
          this.removeEntry(cacheFull);
        }
      } catch (e) {
        // Cannot remove missing file
      }
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
    delete cache[full];
  }

  hasEntry(full) {
    return this.cache[full];
  }

  statEntry(full) {
    const stat = fs.statSync(this.toEntryName(full));
    this.cache[full] = stat;
    return stat;
  }

  clear() {
    if (this.cacheDir) {
      try {
        if (os.platform().startsWith('win')) {
          execSync(`del /S ${this.cacheDir}`, { shell: true });
        } else {
          execSync(`rm -rf ${this.cacheDir}`, { shell: true });
        }
        console.log(`Deleted ${this.cacheDir}`);
      } catch (e) {
        console.log('Failed in deleting');
      }
    }
  }

  fromEntryName(cached) {
    return path.join(this.cwd, cached.replace(this.cacheDir, '').replace(/~/g, path.sep).replace(/@ts$/, '.ts'));
  }

  toEntryName(full) {
    return path.join(this.cacheDir, full.replace(this.cwd, '').replace(/[\/\\]+/g, '~').replace(/.ts$/, '@ts'));
  }
}

exports.Cache = Cache;