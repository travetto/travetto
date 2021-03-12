import * as fss from 'fs';
import * as path from 'path';

import { ExecUtil } from './exec';
import { PathUtil } from './path';

const fs = fss.promises;

/**
 * Standard utils for interacting with the file system
 */
export class FsUtil {

  /**
   * Command to remove a folder
   * @param pth Thefolder to delete
   */
  private static unlinkCommand(pth: string): [string, string[]] {
    if (!pth || pth === '/') {
      throw new Error('Path has not been defined');
    }
    if (process.platform === 'win32') {
      return ['rmdir', ['/Q', '/S', PathUtil.toNative(pth)]];
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
      return ['xcopy', ['/y', '/h', '/s', PathUtil.toNative(src), PathUtil.toNative(dest)]];
    } else {
      return ['cp', ['-r', '-p', src, dest]];
    }
  }

  /**
   * See if file exists
   * @param f The file to check
   */
  static existsSync(f: string) {
    try {
      return fss.statSync(f);
    } catch {
      return undefined;
    }
  }

  /**
   * See if file exists
   * @param f The file to check
   */
  static exists(f: string) {
    return fs.stat(f).catch(() => undefined);
  }

  /**
   * Make directory and all intermediate ones as well
   * @param pth The folder to make
   */
  static async mkdirp(pth: string) {
    try {
      await fs.stat(pth);
    } catch (e) {
      await this.mkdirp(path.dirname(pth));
      try {
        await fs.mkdir(pth);
      } catch (err) {
        if (!/already exists/.test(err)) {
          throw err;
        }
      }
    }
  }

  /**
   * Make directory and all intermediate ones as well, synchronously
   * @param pth The folder to make
   */
  static mkdirpSync(pth: string) {
    try {
      fss.statSync(pth);
    } catch (e) {
      this.mkdirpSync(path.dirname(pth));
      fss.mkdirSync(pth);
    }
  }

  /**
   * Find latest timestamp between creation and modification
   */
  static maxTime(stat: fss.Stats) {
    return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
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
    return ignore ? prom.catchAsResult() : prom;
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
   * OS aware file opening
   */
  static nativeOpen(pth: string) {
    const op = process.platform === 'darwin' ? ['open', pth] :
      process.platform === 'win32' ? ['cmd', '/c', 'start', pth] :
        ['xdg-open', pth];

    ExecUtil.spawn(op[0], op.slice(1));
  }

  /**
   * Symlink, with some platform specific support
   */
  static async symlink(actual: string, linkPath: string) {
    try {
      await fs.lstat(linkPath);
    } catch (e) {
      const file = (await fs.stat(actual)).isFile();
      await fs.symlink(actual, linkPath, process.platform === 'win32' ? (file ? 'file' : 'junction') : undefined);
      await fs.lstat(linkPath); // Ensure created
    }
  }

  /**
   * Symlink, with some platform specific support, synchronously
   */
  static symlinkSync(actual: string, linkPath: string) {
    try {
      fss.lstatSync(linkPath);
    } catch (e) {
      const file = fss.statSync(actual).isFile();
      fss.symlinkSync(actual, linkPath, process.platform === 'win32' ? (file ? 'file' : 'junction') : undefined);
      fss.lstatSync(linkPath); // Ensure created
    }
  }
}