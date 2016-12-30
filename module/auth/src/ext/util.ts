import * as crypto from 'crypto';
import { nodeToPromise } from '@encore/util';
import { AppError } from '@encore/express';

export class MongoStrategyUtil {
  static async generateHash(password: string, salt: string, iterations = 25000, keylen = 512, digest = 'sha512') {
    return (await nodeToPromise<Buffer>(crypto, crypto.pbkdf2, password, salt, iterations, keylen, digest)).toString('hex');
  }

  static async generateSalt(saltlen = 32) {
    return (await nodeToPromise<NodeBuffer>(crypto, crypto.randomBytes, saltlen)).toString('hex');
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

    let salt = await MongoStrategyUtil.generateSalt(saltlen);
    let hash = await MongoStrategyUtil.generateHash(password, salt);

    return { salt, hash };
  }
}