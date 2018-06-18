import * as crypto from 'crypto';
import { ERR_MISSING_PASSWORD, ERR_INVALID_PASSWORD } from '../types';

export class AuthUtil {
  static async generateHash(password: string, salt: string, iterations = 25000, keylen = 256, digest = 'sha256') {
    return new Promise<string>((res, rej) =>
      crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, val) => {
        if (err) {
          rej(err);
        } else {
          res(val.toString('hex'));
        }
      })
    );
  }

  static async generateSalt(saltlen = 32) {
    return await new Promise<string>((res, rej) =>
      crypto.randomBytes(saltlen, (err, val) => {
        if (err) {
          rej(err);
        } else {
          res(val.toString('hex'));
        }
      }));
  }

  static async generatePassword(password: string, saltlen = 32, validator?: (password: string) => Promise<boolean>) {
    if (!password) {
      throw new Error(ERR_MISSING_PASSWORD);
    }

    if (validator !== undefined) {
      if (!await validator(password)) {
        throw new Error(ERR_INVALID_PASSWORD);
      }
    }

    const salt = await this.generateSalt(saltlen);
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }
}