import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { ExecUtil, ExecutionResult } from './exec';

const fsStat = util.promisify(fs.stat);
const fsMkdir = util.promisify(fs.mkdir);

/**
 * Execute a command
 */
function execCmd(sync: false, [cmd, args]: [string, string[]], ignoreErrors?: boolean): Promise<ExecutionResult>;
function execCmd(sync: true, [cmd, args]: [string, string[]], ignoreErrors?: boolean): string;
function execCmd(sync: boolean, [cmd, args]: [string, string[]], ignoreErrors = false): string | undefined | Promise<ExecutionResult> {
  try {
    const ret = sync ? ExecUtil.execSync(`${cmd} ${args.join(' ')}`) : ExecUtil.spawn(cmd, args).result;
    return typeof ret !== 'string' && ignoreErrors ? ret.catch(e => e.meta as ExecutionResult) : ret;
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

  static readonly cwd = process.cwd().replace(/[\/\\]+/g, '/').replace(/\/$/, '');


  /**
   * Command to remove a folder
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
   * See if file exists
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
   */
  static exists(f: string) {
    return fsStat(f).catch(() => undefined);
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