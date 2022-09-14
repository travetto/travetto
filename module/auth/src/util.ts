import * as crypto from 'crypto';
import * as util from 'util';

import { AppError, Util } from '@travetto/base';

const pbkdf2 = util.promisify(crypto.pbkdf2);

/**
 * Standard auth utilities
 */
export class AuthUtil {

  static #matchPermissionSet(rule: string[], perms: Set<string>): boolean {
    for (const el of rule) {
      if (!perms.has(el)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Build matcher for role permissions in allow/deny fashion
   *
   * @param roles Roles to build matcher for
   */
  static roleMatcher(roles: string[]): (perms: Set<string>) => boolean {
    return Util.allowDenyMatcher<string[], [Set<string>]>(roles,
      x => x.split('|'),
      this.#matchPermissionSet.bind(this),
    );
  }

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
    return pbkdf2(value, salt, iterations, half, digest).then(x => x.toString('hex').substring(0, keylen));
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
      throw new AppError('Password is required', 'data');
    }

    salt = typeof salt === 'number' ? Util.uuid(salt) : salt;
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }
}