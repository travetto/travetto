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
  static toUnix(pth: string): string {
    return pth.replace(/[\\\/]+/g, '/');
  }

  /**
   * Convert file to the native format
   * @param pth The path to convert
   */
  static toNative(pth: string): string {
    return pth.replace(/[\\\/]+/g, path.sep);
  }

  /**
   * Resolve path to use / for directory separator
   * @param paths The paths to resolve
   */
  static resolveUnix(...paths: string[]): string {
    return this.toUnix(path.resolve(this.cwd, ...paths));
  }

  /**
   * Path.join, and coercing to unix
   * @param paths The paths to join
   */
  static joinUnix(...paths: string[]): string {
    return this.toUnix(path.join(...paths));
  }
}