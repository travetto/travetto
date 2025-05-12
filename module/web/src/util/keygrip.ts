import crypto, { BinaryToTextEncoding } from 'node:crypto';
import { AppError, castKey } from '@travetto/runtime';

const CHAR_MAPPING = { '/': '_', '+': '-', '=': '' };

function timeSafeCompare(a: string, b: string): boolean {
  const key = crypto.pseudoRandomBytes(32);
  const ah = crypto.createHmac('sha256', key).update(a).digest();
  const bh = crypto.createHmac('sha256', key).update(b).digest();
  return ah.length === bh.length && crypto.timingSafeEqual(ah, bh);
}

export class KeyGrip {

  #keys: string[];
  #algorithm: string;
  #encoding: BinaryToTextEncoding;

  constructor(keys: string[], algorithm = 'sha1', encoding: BinaryToTextEncoding = 'base64') {
    if (!keys.length) {
      throw new AppError('Keys must be defined');
    }
    this.#keys = keys;
    this.#algorithm = algorithm;
    this.#encoding = encoding;
  }

  sign(data: string, key?: string): string {
    return crypto
      .createHmac(this.#algorithm, key ?? this.#keys[0])
      .update(data)
      .digest(this.#encoding)
      .replace(/[/+=]/g, x => CHAR_MAPPING[castKey(x)]);
  }

  verify(data: string, digest: string): boolean {
    return this.index(data, digest) > -1;
  }

  index(data: string, digest: string): number {
    return this.#keys.findIndex(key => timeSafeCompare(digest, this.sign(data, key)));
  }
}
