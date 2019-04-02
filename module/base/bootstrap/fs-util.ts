import * as os from 'os';
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { execSync, exec } from 'child_process';

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);
const execProm = util.promisify(exec);

const peTcd = process.env.TRV_CACHE_DIR;

class $FsUtil {
  cacheDir: string;
  cwd: string;
  subPkgName: string;

  constructor(cwd: string) {
    this.cwd = this.toUnix(cwd).replace(/[\/]+$/, '');
    const defCache = this.joinUnix(os.tmpdir(), this.cwd.replace(/[\/:]/g, '_'));
    const cacheDir = peTcd === 'PID' ? `${defCache}_${process.pid}` : (peTcd && peTcd !== '-' ? peTcd : defCache);
    this.cacheDir = this.resolveUnix(this.cwd, cacheDir);

    for (const el of Object.keys(this) as (keyof this)[]) {
      if (this[el] && (this[el] as any).bind) {
        this[el] = (this[el] as any).bind(this);
      }
    }
  }

  toUnix(rest: string) {
    return rest.replace(/[\\\/]+/g, '/');
  }

  toNative(rest: string) {
    return rest.replace(/[\\\/]+/g, path.sep);
  }

  resolveUnix(...rest: string[]) {
    return this.toUnix(path.resolve(...rest));
  }

  resolveNative(...rest: string[]) {
    return this.toNative(path.resolve(...rest));
  }

  joinUnix(...rest: string[]) {
    return this.toUnix(path.join(...rest));
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
      execSync(this.unlinkCommand(pth));
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

  prepareTranspile(fileName: string, contents?: string) {
    let fileContents = contents || fs.readFileSync(fileName, 'utf-8');

    let line = 1;

    // Insert filename into all log statements for all components, when logger isn't loaded
    fileContents = fileContents.replace(/(\bconsole[.](debug|info|trace|warn|log|error)[(])|\n/g, a => {
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
      if (!this.subPkgName) {
        const pkgName = require(this.joinUnix(this.cwd, 'package.json')).name;
        this.subPkgName = pkgName.split('/').pop();
      }
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
    /** @type string */
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

export const FsUtil = new $FsUtil(process.cwd());