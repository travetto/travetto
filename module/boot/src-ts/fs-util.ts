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

  makeLinkSync(actual: string, linkPath: string) {
    try {
      fs.lstatSync(linkPath);
    } catch (e) {
      const file = fs.statSync(actual).isFile();
      fs.symlinkSync(actual, linkPath, process.platform === 'win32' ? (file ? 'file' : 'junction') : undefined);
      fs.lstatSync(linkPath); // Ensure created
    }
  }

  async mkdirp(pth: string) {
    try {
      await fsStat(pth);
    } catch (e) {
      await this.mkdirp(path.dirname(pth));
      await fsMkdir(pth);
    }
  }

  mkdirpSync(pth: string) {
    try {
      fs.statSync(pth);
    } catch (e) {
      this.mkdirpSync(path.dirname(pth));
      fs.mkdirSync(pth);
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
    return execProm(this.unlinkCommand(pth)).catch(err => {
      if (!ignore) {
        throw err;
      }
    });
  }
}

export const FsUtil = new $FsUtil();