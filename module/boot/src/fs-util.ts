import * as os from 'os';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);
const execProm = util.promisify(cp.exec);

class $FsUtil {
  private subPkgName: string;
  cacheDir: string;
  cwd: string;

  constructor() {
    for (const el of Object.keys(this) as (keyof $FsUtil)[]) {
      if (this[el] && 'bind ' in (this[el] as any)) {
        this[el] = (this[el] as any).bind(this);
      }
    }

    const cwd = this.cwd = this.toUnix(process.cwd()).replace(/[\/]+$/, '');
    const defCache = this.joinUnix(os.tmpdir(), cwd.replace(/[\/:]/g, '_'));

    const pkgName = require(this.joinUnix(cwd, 'package.json')).name;
    this.subPkgName = pkgName.split('/').pop();

    const peTcd = process.env.TRV_CACHE_DIR;
    const cacheDir = peTcd === 'PID' ? `${defCache}_${process.pid}` : (peTcd && peTcd !== '-' ? peTcd : defCache);

    this.cacheDir = this.resolveUnix(cwd, cacheDir);
  }

  async mkdirp(pth: string) {
    if (pth) {
      try {
        await fsStat(pth);
      } catch (e) {
        await this.mkdirp(path.dirname(pth));
        await fsMkdir(pth);
      }
    }
  }
  unlinkCommand(pth: string) {
    if (!pth || pth === '/') {
      throw new Error('Path has not been defined');
    }
    if (process.platform === 'win32') {
      return `rmdir /Q /S ${this.toNative(pth)}`;
    } else {
      return `rm -rf ${pth}`;
    }
  }
  unlinkRecursiveSync(pth: string, ignore = false) {
    try {
      cp.execSync(this.unlinkCommand(pth));
    } catch (e) {
      if (!ignore) {
        throw e;
      }
    }
  }
  unlinkRecursive(pth: string, ignore = false) {
    execProm(this.unlinkCommand(pth)).catch(err => {
      if (!ignore) {
        throw err;
      }
    });
  }
  toUnix(rest: string) {
    return rest.replace(/[\\\/]+/g, '/');
  }

  resolveNative(...rest: string[]) {
    return this.toNative(path.resolve(...rest));
  }

  resolveUnix(...rest: string[]) {
    return this.toUnix(path.resolve(...rest));
  }

  toNative(rest: string) {
    return rest.replace(/[\\\/]+/g, path.sep);
  }

  joinUnix(...rest: string[]) {
    return this.toUnix(path.join(...rest));
  }

  prepareTranspile(fileName: string, contents?: string) {
    let fileContents = contents || fs.readFileSync(fileName, 'utf-8');

    let line = 1;

    // Insert filename into all log statements for all components, when logger isn't loaded
    fileContents = fileContents.replace(/(\bconsole[.](debug|info|trace|warn|log|error)[(])|\n/g,
      a => {
        if (a === '\n') {
          line += 1;
          return a;
        } else {
          return `${a}'[${this.computeModuleFromFile(fileName)}:${line.toString().padStart(3)}]',`;
        }
      });

    // Drop typescript import, and use global. Great speedup;
    fileContents = fileContents.replace(/import\s+[*]\s+as\s+ts\s+from\s+'typescript';?/g, '');

    return `${fileContents};\nexport const __$TRV = 1;`;
  }

  resolveFrameworkDevFile(pth: string) {
    if (pth.includes('@travetto')) {
      pth = this.toUnix(pth).replace(/^.*\/@travetto\/([^/]+)(\/([^@]+)?)?$/g, (all, name, rest) => {
        const mid = this.subPkgName === name ? '' : `node_modules/@travetto/${name}`;
        return `${this.cwd}/${mid}${rest || ''}`;
      });
    }
    return pth;
  }
  appRootMatcher(paths: string[]) {
    if (!paths.length) {
      return /^$/;
    } else {
      const finalPaths =
        paths.map(x => x.replace(/^[.]\//, '').replace(/^[.]$/g, ''));
      const re = new RegExp(`^(${finalPaths.map(x => `${x === '' ? '' : `${x}/`}(index|src\/)`).join('|')})`);
      return re;
    }
  }
  computeModuleFromFile(fileName: string) {
    let mod = this.toUnix(fileName);

    let ns = '@sys';

    if (mod.includes(this.cwd)) {
      mod = mod.split(this.cwd)[1].replace(/^[\/]+/, '');
      ns = '@app';
    }

    if (mod.startsWith('node_modules')) {
      mod = mod.split('node_modules').pop()!.replace(/^[\/]+/, '');
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
}

export const FsUtil = new $FsUtil();