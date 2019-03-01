const os = require('os');
const fs = require('fs');
const util = require('util');
const path = require('path');
const { execSync, exec } = require('child_process');

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);
const execProm = util.promisify(exec);

const toUnix = (rest) => rest.replace(/[\\\/]+/g, '/');
const toNative = (rest) => rest.replace(/[\\\/]+/g, path.sep);
const resolveUnix = (...rest) => toUnix(path.resolve(...rest));
const resolveNative = (...rest) => toNative(path.resolve(...rest));
const joinUnix = (...rest) => toUnix(path.join(...rest));

const cwd = toUnix(process.env.INIT_CWD || process.cwd()).replace(/[\/]+$/, '');
let defCache = joinUnix(os.tmpdir(), cwd.replace(/[\/:]/g, '_'));

const pkgName = require(joinUnix(cwd, 'package.json')).name;
const subPkgName = pkgName.split('/').pop();

const peTcd = process.env.TRV_CACHE_DIR;
const cacheDir = peTcd === 'PID' ? `${defCache}_${process.pid}` : (peTcd && peTcd !== '-' ? peTcd : defCache);

const FsUtil = {
  cacheDir: resolveUnix(cwd, cacheDir),
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
  unlinkCommand(pth) {
    if (!pth || pth === '/') {
      throw new AppError('Path has not been defined', 'data');
    }
    if (process.platform === 'win32') {
      return `rmdir /Q /S ${FsUtil.toNative(pth)}`;
    } else {
      return `rm -rf ${pth}`;
    }
  },
  unlinkRecursiveSync: (pth, ignore = false) => {
    try {
      execSync(FsUtil.unlinkCommand(pth));
    } catch (e) {
      if (!ignore) {
        throw e;
      }
    }
  },
  unlinkRecursive: (pth, ignore = false) =>
    execProm(FsUtil.unlinkCommand(pth)).catch(err => {
      if (!ignore) {
        throw err;
      }
    }),
  resolveNative,
  resolveUnix,
  toNative,
  toUnix,
  joinUnix,
  prepareTranspile: (fileName) => {
    let fileContents = fs.readFileSync(fileName, 'utf-8').toString();

    // Drop typescript import, and use global. Great speedup;
    fileContents = fileContents.replace(/import\s+[*]\s+as\s+ts\s+from\s+'typescript';?/g, '');

    return `${fileContents};\nexport const _$TRV = 1;`;
  },
  resolveFrameworkDevFile: (pth) => {
    if (pth.includes('@travetto')) {
      pth = FsUtil.toUnix(pth).replace(/^.*\/@travetto\/([^/]+)(\/([^@]+)?)?$/g, (all, name, rest) => {
        const mid = subPkgName === name ? '' : `node_modules/@travetto/${name}`;
        return `${cwd}/${mid}${rest || ''}`;
      });
    }
    return pth;
  }
};

module.exports = { FsUtil };