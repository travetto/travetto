import * as path from 'path';
import * as crypto from 'crypto';

const tsExt = '.ts';
const dtsExt = '.d.ts';
const tjsRe = /[.][tj]s$/;
const tsMatcher = ((file: string): boolean => file.endsWith(tsExt) && !file.endsWith(dtsExt));

export class SystemUtil {
  static readonly cwd = process.cwd().replace(/[\/\\]+/g, '/').replace(/\/$/, '');
  static #devPath: string = process.env.TRV_DEV ?? '';

  static EXT = {
    outputTypes: dtsExt,
    input: tsExt,
    inputMatcher: tsMatcher,
  };

  static PATH = {
    src: 'src',
    srcWithSep: 'src/',
    support: 'support',
    supportWithSep: 'support/',
  };

  /**
   * Generate a random UUID
   * @param len The length of the uuid to generate
   */
  static uuid(len: number = 32): string {
    const bytes = crypto.randomBytes(Math.ceil(len / 2));
    // eslint-disable-next-line no-bitwise
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // eslint-disable-next-line no-bitwise
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return bytes.toString('hex').substring(0, len);
  }

  /**
   * Naive hashing
   */
  static naiveHash(text: string): number {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  /**
   * Convert file to a unix format
   * @param pth The path to convert
   */
  static toUnix(pth: string): string {
    return pth.replace(/[\\\/]+/g, '/');
  }

  /**
   * Resolve path to use / for directory separator
   * @param paths The paths to resolve
   */
  static resolveUnix(...paths: string[]): string {
    return this.toUnix(path.resolve(this.cwd, ...paths));
  }

  /**
   * Normalize file path to act as if not in dev mode
   * @private
   * @param file
   * @returns
   */
  static normalizeFrameworkPath(file: string, prefix = ''): string {
    return this.#devPath ? file.replace(this.#devPath, `${prefix}@travetto`) : file;
  }


  /**
   * Simplifies path name to remove node_modules construct
   * @param file
   */
  static simplifyPath(file: string, localRoot?: string, removeExt = false): string {
    let out = file.replace(/^.*node_modules\//, '');
    if (localRoot !== undefined) {
      out = out.replace(this.cwd, localRoot);
    }
    if (removeExt) {
      out = out.replace(tjsRe, '');
    }
    return out;
  }

  /**
   * Convert a file name, to a proper module reference for importing, and comparing
   * @param file
   */
  static normalizePath(file: string): string {
    return this.simplifyPath(this.normalizeFrameworkPath(file), '.', true);
  }

}