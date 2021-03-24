import * as path from 'path';

const DEV = process.env.TRV_DEV;

/**
 * Standard utils for interacting with the paths
 */
export class PathUtil {

  static readonly cwd = process.cwd().replace(/[\/\\]+/g, '/').replace(/\/$/, '');

  /**
   * Convert file to a unix format
   * @param pth The path to convert
   */
  static toUnix(pth: string) {
    return pth.replace(/[\\\/]+/g, '/');
  }

  /**
   * Convert a given path to a source path
   */
  static toUnixTs(file: string) {
    return file.replace(/[\\\/]+/g, '/').replace(/[.]js$/, '.ts');
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
    return this.toUnix(path.resolve(this.cwd, ...pths));
  }

  /**
   * Path.join, and coercing to unix
   * @param pths The paths to join
   */
  static joinUnix(...pths: string[]) {
    return this.toUnix(path.join(...pths));
  }

  /**
   * Normalize file path to act as if not in dev mode
   * @private
   * @param file
   * @returns
   */
  static normalizeFrameworkPath(file: string, prefix = '') {
    return DEV ? file.replace(DEV, `${prefix}@travetto`) : file;
  }

  /**
   * Resolve dev path to actual location
   * @private
   * @param file
   * @returns
   */
  static resolveFrameworkPath(file: string) {
    return DEV ? file.replace(/.*@travetto/, m => DEV || m) : file;
  }
}