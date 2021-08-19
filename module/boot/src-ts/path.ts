import * as path from 'path';

/**
 * Standard utils for interacting with the paths
 */
export class PathUtil {

  static #devPath = process.env.TRV_DEV;

  static readonly cwd = process.cwd().replace(/[\/\\]+/g, '/').replace(/\/$/, '');

  /**
   * Set Dev path
   *
   * @private
   */
  static setDevPath(pth?: string) {
    this.#devPath = pth ?? process.env.TRV_DEV;
  }

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
    return this.#devPath ? file.replace(this.#devPath, `${prefix}@travetto`) : file;
  }

  /**
   * Resolve dev path to actual location
   * @private
   * @param file
   * @returns
   */
  static resolveFrameworkPath(file: string) {
    return this.#devPath ? file.replace(/.*@travetto/, m => this.#devPath || m) : file;
  }

  /**
   * Simplifies path name to remove node_modules construct
   * @param file
   */
  static simplifyPath(file: string, localRoot?: string, removeExt = false) {
    let out = file.replace(/^.*node_modules\//, '');
    if (localRoot !== undefined) {
      out = out.replace(PathUtil.cwd, localRoot);
    }
    if (removeExt) {
      out = out.replace(/[.][jt]s$/, '');
    }
    return out;
  }
}