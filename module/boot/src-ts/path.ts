import * as path from 'path';

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
}