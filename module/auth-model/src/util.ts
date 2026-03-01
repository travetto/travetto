import { BinaryUtil, CodecUtil, RuntimeError, Util } from '@travetto/runtime';

/**
 * Standard auth utilities
 */
export class AuthModelUtil {

  /**
   * Generate a hash for a given value
   *
   * @param value Value to hash
   * @param salt The salt value
   * @param iterations Number of iterations on hashing
   * @param keylen Length of hash
   * @param digest Digest method
   */
  static async generateHash(value: string, salt: string, iterations = 25000, keylen = 256, digest = 'SHA-256'): Promise<string> {
    const hashKey = await crypto.subtle.importKey(
      'raw',
      BinaryUtil.binaryArrayToBuffer(CodecUtil.fromUTF8String(value)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const result = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: { name: digest },
        salt: BinaryUtil.binaryArrayToBuffer(CodecUtil.fromUTF8String(salt)),
        iterations,
      },
      hashKey,
      keylen * 8
    );

    return BinaryUtil.binaryArrayToUint8Array(result).toHex().substring(0, keylen);
  }

  /**
   * Generate a salted password, with the ability to validate the password
   *
   * @param password
   * @param salt Salt value, or if a number, length of salt
   * @param validator Optional function to validate your password
   */
  static async generatePassword(password: string, salt: number | string = 32): Promise<{ salt: string, hash: string }> {
    if (!password) {
      throw new RuntimeError('Password is required', { category: 'data' });
    }

    salt = typeof salt === 'number' ? Util.uuid(salt) : salt;
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }
}