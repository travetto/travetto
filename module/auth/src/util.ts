import * as crypto from 'crypto';
import * as util from 'util';

import { Util, AppError } from '@travetto/base';

const pbkdf2 = util.promisify(crypto.pbkdf2);

type PermSet = Set<string> | ReadonlySet<string>;

type PermissionChecker = {
  all: (perms: PermSet) => boolean;
  any: (perms: PermSet) => boolean;
};

/**
 * Standard auth utilities
 */
export class AuthUtil {

  static #checkExcCache = new Map<string, PermissionChecker>();
  static #checkIncCache = new Map<string, PermissionChecker>();

  /**
   * Build a permission checker against the provided permissions
   *
   * @param perms Set of permissions to check
   * @param defaultIfEmpty If no perms passed, default to empty
   */
  static #buildChecker(perms: Iterable<string>, defaultIfEmpty: boolean): PermissionChecker {
    const permArr = [...perms].map(x => x.toLowerCase());
    let all = (_: PermSet) => defaultIfEmpty;
    let any = (_: PermSet) => defaultIfEmpty;
    if (permArr.length) {
      all = (uPerms: PermSet) => permArr.every(x => uPerms.has(x));
      any = (uPerms: PermSet) => permArr.some(x => uPerms.has(x));
    }
    return { all, any };
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
  static generateHash(value: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256') {
    const half = Math.trunc(Math.ceil(keylen / 2));
    return pbkdf2(value, salt, iterations, half, digest).then(x => x.toString('hex').substring(0, keylen));
  }

  /**
   * Generate a salted password, with the ability to validate the password
   *
   * @param password
   * @param saltLen Length of salt
   * @param validator Optional function to validate your password
   */
  static async generatePassword(password: string, saltLen = 32) {
    if (!password) {
      throw new AppError('Password is required', 'data');
    }

    const salt = Util.uuid(saltLen);
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }

  /**
   * Build a permission checker off of an include, and exclude set
   *
   * @param include Which permissions to include
   * @param exclude Which permissions to exclude
   * @param matchAll Whether not all permissions should be matched
   */
  static permissionSetChecker(include: Iterable<string>, exclude: Iterable<string>, mode: 'all' | 'any' = 'any') {
    const incKey = [...include].sort().join(',');
    const excKey = [...exclude].sort().join(',');

    if (!this.#checkIncCache.has(incKey)) {
      this.#checkIncCache.set(incKey, this.#buildChecker(include, true));
    }
    if (!this.#checkExcCache.has(excKey)) {
      this.#checkExcCache.set(excKey, this.#buildChecker(exclude, false));
    }

    const includes = this.#checkIncCache.get(incKey)![mode];
    const excludes = this.#checkExcCache.get(excKey)![mode];

    return (perms: PermSet) => includes(perms) && !excludes(perms);
  }
}