import * as fss from 'fs';

import { ExecUtil } from './exec';
import { PathUtil } from './path';

const fs = fss.promises;

const checkPath = (pth: string): void => {
  if (!pth || pth === '/') {
    throw new Error('Path has not been defined');
  }
};

/**
 * Standard utils for interacting with the file system
 */
export class FsUtil {

  /**
   * Command to remove a folder
   * @param pth The folder to delete
   */
  static #unlinkCommand(pth: string): [string, string[]] {
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
  static #copyCommand(src: string, dest: string): [string, string[]] {
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
  static existsSync(f: string): fss.Stats | undefined {
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
  static exists(f: string): Promise<fss.Stats | undefined> {
    return fs.stat(f).catch(() => undefined);
  }

  /**
   * Find latest timestamp between creation and modification
   */
  static maxTime(stat: fss.Stats): number {
    return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
  }

  /**
   * Determine if the current stat is older than the presented value
   * @param current
   * @param next
   * @returns
   */
  static isOlder(current: fss.Stats, next: fss.Stats): boolean {
    return current.ctimeMs < next.ctimeMs || current.mtimeMs < next.mtimeMs;
  }

  /**
   * Remove directory, determine if errors should be ignored
   * @param pth The folder to delete
   * @param ignore Should errors be ignored
   */
  static unlinkRecursiveSync(pth: string): void {
    checkPath(pth);
    if ('rmSync' in fss) {
      fss.rmSync(pth, { recursive: true, force: true });
    } else {
      try {
        ExecUtil.execSync(...this.#unlinkCommand(pth));
      } catch { }
    }
  }

  /**
   * Remove directory, determine if errors should be ignored
   * @param pth The folder to delete
   * @param ignore Should errors be ignored
   */
  static async unlinkRecursive(pth: string): Promise<void> {
    checkPath(pth);
    if ('rm' in fs) {
      await fs.rm(pth, { recursive: true, force: true });
    } else {
      try {
        await ExecUtil.spawn(...this.#unlinkCommand(pth)).result;
      } catch { }
    }
  }

  /**
   * Remove directory, determine if errors should be ignored
   * @param src The folder to copy
   * @param dest The folder to copy to
   * @param ignore Should errors be ignored
   */
  static async copyRecursive(src: string, dest: string, ignore = false): Promise<void> {
    try {
      await ExecUtil.execSync(...this.#copyCommand(src, dest));
    } catch (err) {
      if (!ignore) {
        throw err;
      }
    }
  }

  /**
   * OS aware file opening
   */
  static nativeOpen(pth: string): void {
    const op = process.platform === 'darwin' ? ['open', pth] :
      process.platform === 'win32' ? ['cmd', '/c', 'start', pth] :
        ['xdg-open', pth];

    ExecUtil.spawn(op[0], op.slice(1));
  }
}