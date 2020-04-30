import * as crypto from 'crypto';
import * as util from 'util';

import { Util, AppError } from '@travetto/base';

const pbkdf2 = util.promisify(crypto.pbkdf2);

type Checker = ReturnType<(typeof AuthUtil)['permissionChecker']>;

type PermSet = Set<string> | ReadonlySet<string>;

// TODO: Document
export class AuthUtil {

  private static CHECK_EXC_CACHE = new Map<string, [Checker, Checker]>();
  private static CHECK_INC_CACHE = new Map<string, [Checker, Checker]>();

  static generateHash(password: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256') {
    return pbkdf2(password, salt, iterations, keylen, digest).then(x => x.toString('hex'));
  }

  static async generatePassword(password: string, saltLen = 32, validator?: (password: string) => boolean | Promise<boolean>) {
    if (!password) {
      throw new AppError('Password is required', 'data');
    }

    if (validator !== undefined) {
      if (!(await validator(password))) {
        throw new AppError('Password is invalid', 'data');
      }
    }

    const salt = Util.uuid(saltLen);
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }

  static permissionChecker(perms: PermSet, matchAll = true, defaultIfEmpty = true) {
    const permArr = [...perms].map(x => x.toLowerCase());
    if (permArr.length === 0) {
      return () => defaultIfEmpty;
    }
    return matchAll ?
      (uPerms: PermSet) => !permArr.find(x => !uPerms.has(x)) :
      (uPerms: PermSet) => !!permArr.find(x => uPerms.has(x));
  }

  static permissionSetChecker(include: PermSet, exclude: PermSet, matchAll = true) {
    const incKey = Array.from(include).sort().join(',');
    const excKey = Array.from(include).sort().join(',');

    if (!this.CHECK_INC_CACHE.has(incKey)) {
      this.CHECK_INC_CACHE.set(incKey, [AuthUtil.permissionChecker(include, true, true), AuthUtil.permissionChecker(include, false, true)]);
    }
    if (!this.CHECK_EXC_CACHE.has(excKey)) {
      this.CHECK_EXC_CACHE.set(excKey, [AuthUtil.permissionChecker(exclude, true, false), AuthUtil.permissionChecker(exclude, false, false)]);
    }

    const includes = this.CHECK_INC_CACHE.get(incKey)![matchAll ? 1 : 0];
    const excludes = this.CHECK_EXC_CACHE.get(excKey)![matchAll ? 1 : 0];

    return (perms: PermSet) => includes(perms) && !excludes(perms);
  }
}