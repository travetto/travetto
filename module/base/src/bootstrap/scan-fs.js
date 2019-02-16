const fs = require('fs');
const util = require('util');

const { FsUtil } = require('./fs-util');

const fsReaddir = util.promisify(fs.readdir);
const fsLstat = util.promisify(fs.lstat);
const fsRealpath = util.promisify(fs.realpath);
const fsReadFile = util.promisify(fs.readFile);

const ScanFs = {

  isDir(x) {
    return x.stats.isDirectory() || x.stats.isSymbolicLink();
  },

  isNotDir(x) {
    return !x.stats.isDirectory() && !x.stats.isSymbolicLink();
  },

  scanDir(handler, base, entry = undefined, visited = new Set()) {
    return new Promise(async (resolve, reject) => {

      try {
        const out = [];

        entry = (entry || { file: base, children: [] });

        for (const file of (await fsReaddir(entry.file))) {
          if (file.startsWith('.')) {
            continue;
          }

          const full = FsUtil.resolveUnix(entry.file, file);
          const stats = await fsLstat(full);
          const subEntry = { stats, file: full, module: full.replace(`${base}/`, '') };

          if (ScanFs.isDir(subEntry)) {
            if (subEntry.stats.isSymbolicLink()) {
              const p = await fsRealpath(full);
              if (!visited.has(p)) {
                visited.add(p);
              } else {
                continue;
              }
            }

            if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
              out.push(subEntry, ...await ScanFs.scanDir(handler, base, subEntry, visited));
            }
          } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
            (entry.children = entry.children || []).push(subEntry);
            out.push(subEntry);
          }
        }
        resolve(out);
      } catch (e) {
        reject(e);
      }
    });
  },

  async bulkScanDir(handlers, base) {
    const res = await Promise.all(handlers.map(x => ScanFs.scanDir(x, base)));
    const names = new Set();
    const out = [];
    for (const ls of res) {
      for (const e of ls) {
        if (!names.has(e.file)) {
          names.add(e.file);
          out.push(e);
        }
      }
    }
    return out;
  },

  scanDirSync(handler, base, entry = undefined, visited = new Set()) {
    const out = [];

    entry = (entry || { file: base, children: [] });

    for (const file of fs.readdirSync(entry.file)) {
      if (file.startsWith('.')) {
        continue;
      }

      const full = FsUtil.resolveUnix(entry.file, file);
      const stats = fs.lstatSync(full);
      const subEntry = { stats, file: full, module: full.replace(`${base}/`, '') };

      if (ScanFs.isDir(subEntry)) {
        if (subEntry.stats.isSymbolicLink()) {
          const p = fs.realpathSync(full);
          if (!visited.has(p)) {
            visited.add(p);
          } else {
            continue;
          }
        }
        if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
          out.push(subEntry, ...ScanFs.scanDirSync(handler, base, subEntry, visited));
        }
      } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
        (entry.children = entry.children || []).push(subEntry);
        out.push(subEntry);
      }
    }
    return out;
  },

  bulkScanDirSync(handlers, base) {
    const names = new Set();
    const out = [];
    for (const h of handlers) {
      for (const e of ScanFs.scanDirSync(h, base)) {
        if (!names.has(e.file)) {
          names.add(e.file);
          out.push(e);
        }
      }
    }
    return out;
  },

  bulkRequire(handlers, cwd) {
    return ScanFs.bulkScanDirSync(handlers, cwd)
      .filter(ScanFs.isNotDir) // Skip folders
      .map(x => require(x.file))
      .filter(x => !!x); // Return non-empty values
  },

  async bulkRead(handlers, base) {
    const files = await ScanFs.bulkScanDir(handlers, base);
    const promises = files
      .filter(ScanFs.isNotDir)
      .map(x => fsReadFile(x.file).then(d => ({ name: x.file, data: d.toString() })));
    return await Promise.all(promises);
  },

  bulkReadSync(handlers, base) {
    return ScanFs.bulkScanDirSync(handlers, base)
      .filter(ScanFs.isNotDir)
      .map(x => ({ name: x.file, data: fs.readFileSync(x.file).toString() }));
  }
}

module.exports = { ScanFs };