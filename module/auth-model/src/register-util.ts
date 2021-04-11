import * as crypto from 'crypto';
import * as util from 'util';

import { Util, AppError } from '@travetto/base';

const pbkdf2 = util.promisify(crypto.pbkdf2);

/**
 * Utilities for registration
 */
export class RegistrationUtil {

  /**
   * Generate a hash for a given value
   *
   * @param value Value to hash
   * @param salt The salt value
   * @param iterations Number of iterations on hashing
   * @param keylen Length of hash
   * @param digest Digest method
   */
  static generateHash(value: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256') {
    const half = Math.trunc(Math.ceil(keylen / 2));
    return pbkdf2(value, salt, iterations, half, digest).then(x => x.toString('hex').substring(0, keylen));
  }

  /**
   * Generate a salted password, with the ability to validate the password
   *
   * @param password
   * @param salt Salt value, or if a number, length of salt
   * @param validator Optional function to validate your password
   */
  static async generatePassword(password: string, salt: number | string = 32) {
    if (!password) {
      throw new AppError('Password is required', 'data');
    }

    salt = typeof salt === 'number' ? Util.uuid(salt) : salt;
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }
}