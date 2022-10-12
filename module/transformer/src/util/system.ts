import * as path from 'path';
import * as crypto from 'crypto';

export class SystemUtil {
  static readonly cwd = process.cwd().replace(/[\/\\]+/g, '/').replace(/\/$/, '');

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
}