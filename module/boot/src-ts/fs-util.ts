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
export class FsUtil {

  static cwd = process.cwd().replace(/[\/\\]+/g, '/').replace(/\/$/, '');

  /**
   * Converts filename .ts to .js
   */
  static toJS = (x: string) => x.replace(/\.ts$/, '.js');
  /**
   * Converts filename .js to .ts
   */
  static toTS = (x: string) => x.replace(/\.js$/, '.ts');

  /**
   * Convert file to a unix format
   */
  static toUnix(rest: string) {
    return rest.replace(/[\\\/]+/g, '/');
  }

  /**
   * Convert file to the native format
   */
  static toNative(rest: string) {
    return rest.replace(/[\\\/]+/g, path.sep);
  }

  /**
   * Resolve path to use / for directory seps
   */
  static resolveUnix(...rest: string[]) {
    return this.toUnix(path.resolve(...rest));
  }

  /**
   * Path.join, and coercing to unix
   */
  static joinUnix(...rest: string[]) {
    return this.toUnix(path.join(...rest));
  }

  /**
   * Symlink, with some platform specific support
   */
  static makeLinkSync(actual: string, linkPath: string) {
    try {
      fs.lstatSync(linkPath);
    } catch (e) {
      const file = fs.statSync(actual).isFile();
      fs.symlinkSync(actual, linkPath, process.platform === 'win32' ? (file ? 'file' : 'junction') : undefined);
      fs.lstatSync(linkPath); // Ensure created
    }
  }

  /**
   * Make directory and all intermediate ones as well
   */
  static async mkdirp(pth: string) {
    try {
      await fsStat(pth);
    } catch (e) {
      await this.mkdirp(path.dirname(pth));
      await fsMkdir(pth);
    }
  }

  /**
   * Make directory and all intermediate ones as well, synchronously
   */
  static mkdirpSync(pth: string) {
    try {
      fs.statSync(pth);
    } catch (e) {
      this.mkdirpSync(path.dirname(pth));
      fs.mkdirSync(pth);
    }
  }

  /**
   * Command to remove a folder
   */
  static unlinkCommand(pth: string) {
    if (!pth || pth === '/') {
      throw new Error('Path has not been defined');
    }
    if (process.platform === 'win32') {
      return `rmdir /Q /S ${this.toNative(pth)}`;
    } else {
      return `rm -rf ${pth}`;
    }
  }

  /**
   * Command to copy a folder
   */
  static copyCommand(src: string, dest: string) {
    if (process.platform === 'win32') {
      return `xcopy /y /h /s ${this.toNative(src)} ${this.toNative(dest)}`;
    } else {
      return `cp -r -p ${src} ${dest}`;
    }
  }

  /**
   * Remove directory, determine if errors should be ignored
   */
  static unlinkRecursiveSync(pth: string, ignore = false) {
    return execCmd(true, this.unlinkCommand(pth), ignore);
  }

  /**
   * Remove directory, determine if errors should be ignored
   */
  static unlinkRecursive(pth: string, ignore = false) {
    return execCmd(false, this.unlinkCommand(pth), ignore);
  }

  /**
   * Remove directory, determine if errors should be ignored, synchronously
   */
  static copyRecursiveSync(src: string, dest: string, ignore = false) {
    return execCmd(true, this.copyCommand(src, dest), ignore);
  }
}