const os = require('os');
const fs = require('fs');
const util = require('util');
const path = require('path');
const { execSync } = require('child_process');

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);

const toUnix = (rest) => rest.replace(/[\\\/]+/g, '/');
const toNative = (rest) => rest.replace(/[\\\/]+/g, path.sep);
const resolveUnix = (...rest) => toUnix(path.resolve(...rest));
const resolveNative = (...rest) => toNative(path.resolve(...rest));
const joinUnix = (...rest) => toUnix(path.join(...rest));

const cwd = toUnix(process.env.INIT_CWD || process.cwd()).replace(/[\/]+$/, '');
let defCache = joinUnix(os.tmpdir(), cwd.replace(/[\/:]/g, '_'));

const pkgName = require(joinUnix(cwd, 'package.json')).name;
const subName = pkgName.split('/').pop();

const cacheDir =
  process.env.TRV_CACHE_DIR ?
    (process.env.TRV_CACHE_DIR === 'PID' ?
      `${defCache}_${process.pid}` :
      process.env.TRV_CACHE_DIR
    ) :
    defCache;

const FsUtil = {
  cacheDir,
  cwd,
  async mkdirp(pth) {
    if (pth) {
      try {
        await fsStat(pth);
      } catch (e) {
        await FsUtil.mkdirp(path.dirname(pth));
        await fsMkdir(pth);
      }
    }
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
  joinUnix,
  resolveFrameworkFile: (pth) => {
    if (pth.includes('@travetto')) {
      pth = FsUtil.toUnix(pth).replace(/.*\/@travetto\/([^/]+)\/([^@]+)$/g, (all, name, rest) => {
        const mid = subName === name ? '' : `node_modules/@travetto/${name}/`;
        return `${cwd}/${mid}${rest}`;
      });
    }
    return pth;
  }
};

module.exports = { FsUtil };