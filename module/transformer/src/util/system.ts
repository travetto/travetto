import * as path from 'path';
import * as crypto from 'crypto';

const tsExt = '.ts';
const dtsExt = '.d.ts';
const tsMatcher = ((file: string): boolean => file.endsWith(tsExt) && !file.endsWith(dtsExt));

const CWD = process.cwd().replaceAll('\\', '/');

export class SystemUtil {

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
   * Resolve path to use / for directory separator
   * @param paths The paths to resolve
   */
  static resolveUnix(...paths: string[]): string {
    return path.resolve(CWD, ...paths).replaceAll('\\', '/');
  }

  /**
   * Convert a file name, to a proper module reference for importing, and comparing
   * @param file
   */
  static moduleReference(file: string): string {
    file = file.replaceAll('\\', '/');
    if (file.includes('node_modules')) { // it is a module
      return file.replace(/^.*node_modules\//, '');
    } else {
      return file.replace(CWD, '.');
    }
  }
}