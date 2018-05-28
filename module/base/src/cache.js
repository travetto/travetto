const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

class Cache {
  constructor(cwd, cacheDir = process.env.TS_CACHE_DIR) {
    this.cwd = cwd;

    if (!cacheDir) {
      const name = cwd.replace(/[\/:]/g, '_');
      cacheDir = `${os.tmpdir()}/${name}`;
    }

    this.cacheDir = cacheDir;
    this.cache = {};
  }

  init() {
    const cacheDirN = path.normalize(this.cacheDir);
    if (!fs.existsSync(cacheDirN)) {
      fs.mkdirSync(cacheDirN);
    }

    for (const f of fs.readdirSync(cacheDirN)) {
      const full = this.fromEntryName(f);
      const rel = `${this.cacheDir}/${f}`;
      try {
        const stat = this.statEntry(rel);
        const fullStat = fs.statSync(path.normalize(full));
        if (stat.ctimeMs < fullStat.ctimeMs || stat.mtimeMs < fullStat.mtimeMs || stat.atime < fullStat.mtime) {
          this.removeEntry(rel);
        }
      } catch (e) {
        // Cannot remove missing file
      }
    }
  }

  writeEntry(full, contents) {
    fs.writeFileSync(path.normalize(this.toEntryName(full)), contents);
    this.statEntry(full);
  }

  readEntry(full) {
    return fs.readFileSync(path.normalize(this.toEntryName(full))).toString();
  }

  removeEntry(full) {
    fs.unlinkSync(path.normalize(this.toEntryName(full)));
    delete cache[full];
  }

  hasEntry(full) {
    return this.cache[full];
  }

  statEntry(full) {
    const stat = fs.statSync(path.normalize(this.toEntryName(full)));
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
    return `${this.cwd}/${cached.replace(this.cacheDir, '').replace(/~/g, '/').replace(/@ts$/, '.ts')}`;
  }

  toEntryName(full) {
    return `${this.cacheDir}/${full.replace(this.cwd, '').replace(/[\/]+/g, '~').replace(/.ts$/, '@ts')}`;
  }
}

exports.Cache = Cache;