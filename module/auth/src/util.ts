import * as crypto from 'crypto';
import { AppError } from '@travetto/express';

export class StrategyUtil {
  static async generateHash(password: string, salt: string, iterations = 25000, keylen = 512, digest = 'sha512') {
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
          res(val.toString('hex'))
        }
      }));
  }

  static async generatePassword(password: string, saltlen = 32, validator?: (password: string) => Promise<boolean>) {
    if (!password) {
      throw new AppError('Missing password exception', 501);
    }

    if (validator !== undefined) {
      if (!await validator(password)) {
        throw new AppError('Invalid password', 503);
      }
    }

    const salt = await this.generateSalt(saltlen);
    const hash = await this.generateHash(password, salt);

    return { salt, hash };
  }
}