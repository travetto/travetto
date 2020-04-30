import * as crypto from 'crypto';
import * as util from 'util';

import { Util, AppError } from '@travetto/base';

const pbkdf2 = util.promisify(crypto.pbkdf2);

type Checker = ReturnType<(typeof AuthUtil)['permissionChecker']>;

type PermSet = Set<string> | ReadonlySet<string>;

/**
 * Standard auth utilities
 */
export class AuthUtil {

  private static CHECK_EXC_CACHE = new Map<string, [Checker, Checker]>();
  private static CHECK_INC_CACHE = new Map<string, [Checker, Checker]>();

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
   * Build a permission checker against the provided permissions
   *
   * @param perms Set of permissions to check
   * @param matchAll Whether or not all permissions are needed to satisfy
   * @param defaultIfEmpty If no perms passed, default to empty
   */
  static permissionChecker(perms: PermSet, matchAll = true, defaultIfEmpty = true) {
    const permArr = [...perms].map(x => x.toLowerCase());
    if (permArr.length === 0) {
      return () => defaultIfEmpty;
    }
    return matchAll ?
      (uPerms: PermSet) => !permArr.find(x => !uPerms.has(x)) :
      (uPerms: PermSet) => !!permArr.find(x => uPerms.has(x));
  }

  /**
   * Build a permission checker off of permissions to include, and exclude
   *
   * @param include Which permissions to include
   * @param exclude Which permissions to exclude
   * @param matchAll Whether not all permissions should be matched
   */
  static permissionSetChecker(include: PermSet, exclude: PermSet, matchAll = true) {
    const incKey = Array.from(include).sort().join(',');
    const excKey = Array.from(include).sort().join(',');

    if (!this.CHECK_INC_CACHE.has(incKey)) {
      this.CHECK_INC_CACHE.set(incKey, [this.permissionChecker(include, true, true), this.permissionChecker(include, false, true)]);
    }
    if (!this.CHECK_EXC_CACHE.has(excKey)) {
      this.CHECK_EXC_CACHE.set(excKey, [this.permissionChecker(exclude, true, false), this.permissionChecker(exclude, false, false)]);
    }

    const includes = this.CHECK_INC_CACHE.get(incKey)![matchAll ? 1 : 0];
    const excludes = this.CHECK_EXC_CACHE.get(excKey)![matchAll ? 1 : 0];

    return (perms: PermSet) => includes(perms) && !excludes(perms);
  }
}