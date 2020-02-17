import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { execSync, exec } from 'child_process';

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);
const execProm = util.promisify(exec);

class $FsUtil {

  cwd: string;

  constructor() {
    for (const el of Object.keys(this) as (keyof this)[]) {
      if (this[el] && (this[el] as any).bind) {
        this[el] = (this[el] as any).bind(this);
      }
    }
    this.cwd = this.toUnix(process.cwd()).replace(/\/$/, '');
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

  computeModule(fileName: string) {
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