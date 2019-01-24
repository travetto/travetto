//@ts-check

const fs = require('fs');
const path = require('path');
const os = require('os');

const { execSync } = require('child_process');

const toUnix = (rest) => rest.replace(/[\\\/]+/g, '/');
const toNative = (rest) => rest.replace(/[\\\/]+/g, path.sep);
const resolveUnix = (...rest) => toUnix(path.resolve(...rest));
const resolveNative = (...rest) => toNative(path.resolve(...rest));
const joinUnix = (...rest) => toUnix(path.join(...rest));

const cwd = toUnix(process.env.INIT_CWD || process.cwd()).replace(/[\/]+$/, '');
let defCache = joinUnix(os.tmpdir(), cwd.replace(/[\/:]/g, '_'));

const cacheDir =
  process.env.TRV_CACHE_DIR ?
    (process.env.TRV_CACHE_DIR === 'PID' ?
      `${defCache}_${process.pid}` :
      process.env.TRV_CACHE_DIR
    ) :
    defCache;

const FsUtil = {
  cwd,
  cacheDir,
  tempDir: (pre) => fs.mkdtempSync(path.resolve(os.tmpdir(), pre)),
  writeFile: (rel, contents) => fs.writeFileSync(rel, contents),
  readFile: (rel) => fs.readFileSync(rel).toString(),
  removeAll: (files) => (files || []).map(x => FsUtil.remove(x)),
  move: (from, to) => fs.renameSync(from, to),
  isDir: (f) => FsUtil.stat(f) && FsUtil.stat(f).isDirectory(),
  stat: (p) => {
    try {
      return fs.statSync(p);
    } catch (e) {
      try {
        return fs.lstatSync(p);
      } catch (e2) {
        return;
      }
    }
  },
  remove(pth) {
    try {
      if (!FsUtil.stat(pth)) {
        return;
      }
      if (FsUtil.isDir(pth)) {
        for (const f of FsUtil.find(pth, undefined, true)) {
          if (FsUtil.isDir(f)) {
            fs.rmdirSync(f);
          } else {
            fs.unlinkSync(f);
          }
        }
        fs.rmdirSync(pth);
      } else {
        fs.unlinkSync(pth);
      }
    } catch (e) {
      console.log('Failed to remove', pth, e);
    }
  },
  mkdirp(pth) {
    try {
      fs.statSync(pth);
    } catch (e) {
      try {
        fs.mkdirSync(pth);
      } catch (e) {
        FsUtil.mkdirp(path.dirname(pth));
        fs.mkdirSync(pth);
      }
    }
  },
  find(pth, test, dirs = false) {
    const list = [];

    for (const f of fs.readdirSync(pth)) {
      const subPth = FsUtil.resolveUnix(pth, f);
      try {
        if (FsUtil.isDir(subPth)) {
          list.push(...FsUtil.find(subPth, test, dirs));
          if (dirs && (!test || test(subPth))) {
            list.push(FsUtil.toUnix(subPth));
          }
        } else if (!test || test(subPth)) {
          list.push(FsUtil.toUnix(subPth));
        }
      } catch (e) { }
    }
    return list;
  },
  unlinkDirSync(pth) {
    if (process.platform === 'win32') {
      execSync(`rmdir /Q /S ${FsUtil.toNative(pth)}`);
    } else {
      execSync(`rm -rf ${pth}`);
    }
  },
  resolveNative,
  resolveUnix,
  toNative,
  toUnix,
  joinUnix
};

module.exports = { FsUtil };