import crypto from 'node:crypto';
import util from 'node:util';

import { RuntimeError, Util } from '@travetto/runtime';

const pbkdf2 = util.promisify(crypto.pbkdf2);

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
  static generateHash(value: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256'): Promise<string> {
    const half = Math.trunc(Math.ceil(keylen / 2));
    return pbkdf2(value, salt, iterations, half, digest).then(buffer => buffer.toString('hex').substring(0, keylen));
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