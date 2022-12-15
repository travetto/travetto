import * as crypto from 'crypto';

const tsExt = '.ts';
const dtsExt = '.d.ts';
const tsMatcher = ((file: string): boolean => file.endsWith(tsExt) && !file.endsWith(dtsExt));

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
}