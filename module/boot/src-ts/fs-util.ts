import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { execSync, exec } from 'child_process';

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);
const execProm = util.promisify(exec);

function execCmd(sync: false, cmd: string, ignoreErrors?: boolean): Promise<{ stdout: string, stderr: string }>;
function execCmd(sync: true, cmd: string, ignoreErrors?: boolean): Buffer;
function execCmd(sync: boolean, cmd: string, ignoreErrors = false) {
  try {
    const ret = sync ? execSync(cmd) : execProm(cmd);
    return 'then' in ret && ignoreErrors ? ret.catch(e => { }) : ret;
  } catch (e) {
    if (!ignoreErrors) {
      throw e;
    }
  }
}

/**
 * Standard utils for interacting with the file system
 */
// TODO: Convert to static class
// TODO: Document
class $FsUtil {

  cwd: string;

  constructor() {
    this.cwd = this.toUnix(process.cwd()).replace(/\/$/, '');
  }

  toJS = (x: string) => x.replace(/\.ts$/, '.js');
  toTS = (x: string) => x.replace(/\.js$/, '.ts');

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

  copyCommand(src: string, dest: string) {
    if (process.platform === 'win32') {
      return `xcopy /y /h /s ${this.toNative(src)} ${this.toNative(dest)}`;
    } else {
      return `cp -r -p ${src} ${dest}`;
    }
  }

  unlinkRecursiveSync(pth: string, ignore = false) {
    return execCmd(true, this.unlinkCommand(pth), ignore);
  }

  unlinkRecursive(pth: string, ignore = false) {
    return execCmd(false, this.unlinkCommand(pth), ignore);
  }

  copyRecursiveSync(src: string, dest: string, ignore = false) {
    return execCmd(true, this.copyCommand(src, dest), ignore);
  }
}

export const FsUtil = new $FsUtil();