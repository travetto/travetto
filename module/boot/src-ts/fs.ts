import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { ExecUtil } from './exec';

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);

/**
 * Standard utils for interacting with the file system
 */
export class FsUtil {

  static readonly cwd = process.cwd().replace(/[\/\\]+/g, '/').replace(/\/$/, '');

  /**
   * Command to remove a folder
   * @param pth Thefolder to delete
   */
  private static unlinkCommand(pth: string): [string, string[]] {
    if (!pth || pth === '/') {
      throw new Error('Path has not been defined');
    }
    if (process.platform === 'win32') {
      return ['rmdir', ['/Q', '/S', this.toNative(pth)]];
    } else {
      return ['rm', ['-r', pth]];
    }
  }

  /**
   * Command to copy a folder
   * @param pth The folder to copy
   */
  private static copyCommand(src: string, dest: string): [string, string[]] {
    if (process.platform === 'win32') {
      return ['xcopy', ['/y', '/h', '/s', this.toNative(src), this.toNative(dest)]];
    } else {
      return ['cp', ['-r', '-p', src, dest]];
    }
  }

  /**
   * Convert file to a unix format
   * @param pth The path to convert
   */
  static toUnix(pth: string) {
    return pth.replace(/[\\\/]+/g, '/');
  }

  /**
   * Convert file to the native format
   * @param pth The path to convert
   */
  static toNative(pth: string) {
    return pth.replace(/[\\\/]+/g, path.sep);
  }

  /**
   * Resolve path to use / for directory seps
   * @param pths The paths to resolve
   */
  static resolveUnix(...pths: string[]) {
    return this.toUnix(path.resolve(...pths));
  }

  /**
   * Path.join, and coercing to unix
   * @param pths The paths to join
   */
  static joinUnix(...pths: string[]) {
    return this.toUnix(path.join(...pths));
  }

  /**
   * See if file exists
   * @param f The file to check
   */
  static existsSync(f: string) {
    try {
      return fs.statSync(f);
    } catch {
      return undefined;
    }
  }

  /**
   * See if file exists
   * @param f The file to check
   */
  static exists(f: string) {
    return fsStat(f).catch(() => undefined);
  }

  /**
   * Make directory and all intermediate ones as well
   * @param pth The folder to make
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
   * @param pth The folder to make
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
   * Remove directory, determine if errors should be ignored
   * @param pth The folder to delete
   * @param ignore Should errors be ignored
   */
  static unlinkRecursiveSync(pth: string, ignore = false) {
    const cmd = this.unlinkCommand(pth);
    try {
      return ExecUtil.execSync(...cmd);
    } catch (err) {
      if (!ignore) {
        throw err;
      }
    }
  }

  /**
   * Remove directory, determine if errors should be ignored
   * @param pth The folder to delete
   * @param ignore Should errors be ignored
   */
  static unlinkRecursive(pth: string, ignore = false) {
    const prom = ExecUtil.spawn(...this.unlinkCommand(pth)).result;
    return ignore ? prom.catch(e => e.meta) : prom;
  }

  /**
   * Remove directory, determine if errors should be ignored, synchronously
   * @param src The folder to copy
   * @param dest The folder to copy to
   * @param ignore Should errors be ignored
   */
  static copyRecursiveSync(src: string, dest: string, ignore = false) {
    try {
      return ExecUtil.execSync(...this.copyCommand(src, dest));
    } catch (err) {
      if (!ignore) {
        throw err;
      }
    }
  }

  /**
   * Find latest timestamp between creation and modification
   */
  static maxTime(stat: fs.Stats) {
    return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
  }
}