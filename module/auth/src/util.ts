import * as crypto from 'crypto';
import * as util from 'util';

import { AppError } from '@travetto/base';

const pbkdf2 = util.promisify(crypto.pbkdf2);
const randomBytes = util.promisify(crypto.randomBytes);
const toHex = (val: Buffer) => val.toString('hex');

type Checker = ReturnType<(typeof AuthUtil)['permissionChecker']>;

export class AuthUtil {

  private static CHECK_CACHE = new Map<Set<string> | string[], [Checker, Checker]>();

  static generateHash(password: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256') {
    return pbkdf2(password, salt, iterations, keylen, digest).then(toHex);
  }

  static generateSalt(len: number = 32) {
    return randomBytes(len).then(toHex);
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

    const salt = await this.generateSalt(saltLen);
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }

  static permissionChecker(perms: string[] | Set<string>, matchAll = true) {
    const permArr = [...perms].map(x => x.toLowerCase());
    const permSet = new Set(permArr);
    return matchAll ?
      (uPerms: Set<string>) => !permArr.find(x => !uPerms.has(x)) :
      (uPerms: Set<string>) => !!permArr.find(x => uPerms.has(x));
  }

  static permissionSetChecker(include: string[] | Set<string>, exclude: string[] | Set<string>, matchAll = true) {
    if (!this.CHECK_CACHE.has(include)) {
      this.CHECK_CACHE.set(include, [AuthUtil.permissionChecker(include, true), AuthUtil.permissionChecker(include, false)]);
    }
    if (!this.CHECK_CACHE.has(exclude)) {
      this.CHECK_CACHE.set(exclude, [AuthUtil.permissionChecker(exclude, true), AuthUtil.permissionChecker(exclude, false)]);
    }

    const includes = this.CHECK_CACHE.get(include)![matchAll ? 1 : 0];
    const excludes = this.CHECK_CACHE.get(exclude)![matchAll ? 1 : 0];

    return (perms: Set<string>) => includes(perms) && !excludes(perms);
  }
}