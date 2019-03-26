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
  prepareTranspile: (fileName, contents) => {
    let fileContents = contents || fs.readFileSync(fileName, 'utf-8');

    let line = 1;

    // Insert filename into all log statements for all components, when logger isn't loaded
    fileContents = fileContents.replace(/(\bconsole[.](debug|info|trace|warn|log|error)[(])|\n/g,
      a => {
        if (a === '\n') {
          line += 1;
          return a;
        } else {
          return `${a}'[${FsUtil.computeModuleFromFile(fileName)}:${line.toString().padStart(3)}]',`;
        }
      });

    // Drop typescript import, and use global. Great speedup;
    fileContents = fileContents.replace(/import\s+[*]\s+as\s+ts\s+from\s+'typescript';?/g, '');

    return `${fileContents};\nexport const __$TRV = 1;`;
  },
  resolveFrameworkDevFile: (pth) => {
    if (pth.includes('@travetto')) {
      pth = FsUtil.toUnix(pth).replace(/^.*\/@travetto\/([^/]+)(\/([^@]+)?)?$/g, (all, name, rest) => {
        const mid = subPkgName === name ? '' : `node_modules/@travetto/${name}`;
        return `${cwd}/${mid}${rest || ''}`;
      });
    }
    return pth;
  },
  appRootMatcher: (paths) => {
    if (!paths.length) {
      return /^$/;
    } else {
      const finalPaths =
        paths.map(x => x.replace(/^[.]\//, '').replace(/^[.]$/g, ''));
      const re = new RegExp(`^(${finalPaths.map(x => `${x === '' ? '' : `${x}/`}(index|src\/)`).join('|')})`);
      return re;
    }
  },
  computeModuleFromFile: (fileName) => {
    /** @type string */
    let mod = FsUtil.toUnix(fileName);

    let ns = '@sys';

    if (mod.includes(cwd)) {
      mod = mod.split(cwd)[1].replace(/^[\/]+/, '');
      ns = '@app';
    }

    if (mod.startsWith('node_modules')) {
      mod = mod.split('node_modules').pop().replace(/^[\/]+/, '');
    }

    if (mod.startsWith('@')) {
      const [ns1, ns2, ...rest] = mod.split(/[\/]/);
      ns = `${ns1}:${ns2}`.replace('@travetto', '@trv');
      if (rest[0] === 'src') {
        rest.shift();
      }
      mod = rest.join('.');
    }

    mod = mod
      .replace(/[\/]+/g, '.')
      .replace(/^\./, '')
      .replace(/\.(t|j)s$/, '');

    return `${ns}/${mod}`;
  }
};

module.exports = { FsUtil };