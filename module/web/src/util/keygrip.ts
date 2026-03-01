import { timingSafeEqual } from 'node:crypto';

import { BinaryUtil, CodecUtil, type BinaryArray } from '@travetto/runtime';

const CHAR_MAPPING: Record<string, string> = { '/': '_', '+': '-', '=': '' };

export class KeyGrip {

  static async getRandomHmacKey(): Promise<CryptoKey> {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }

  static async hmac(value: string, cryptoKey: CryptoKey): Promise<BinaryArray> {
    const input = BinaryUtil.binaryArrayToBuffer(CodecUtil.fromUTF8String(value));
    return BinaryUtil.binaryArrayToUint8Array(await crypto.subtle.sign('HMAC', cryptoKey, input));
  }

  #keys: string[];
  #cryptoKeys = new Map<string, Promise<CryptoKey>>();

  constructor(keys: string[]) {
    this.#keys = keys;
  }

  get active(): boolean {
    return this.#keys.length > 0;
  }

  async getCryptoKey(key: string): Promise<CryptoKey> {
    return this.#cryptoKeys.getOrInsertComputed(key, async () => {
      const keyBytes = BinaryUtil.binaryArrayToBuffer(CodecUtil.fromUTF8String(key));
      return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    });
  }

  async sign(data: string, key?: string): Promise<string> {
    const cryptoKey = await this.getCryptoKey(key ?? this.#keys[0]);
    const signature = await KeyGrip.hmac(data, cryptoKey);
    return CodecUtil.toBase64String(signature).replace(/[/+=]/g, ch => CHAR_MAPPING[ch]);
  }

  verify(data: string, digest: string): Promise<boolean> {
    return this.isValid(data, digest).then(result => result !== 'invalid');
  }

  async isValid(data: string, digest: string): Promise<'valid' | 'invalid' | 'stale'> {
    const key = await KeyGrip.getRandomHmacKey();
    const digestBytes = BinaryUtil.binaryArrayToUint8Array(await KeyGrip.hmac(digest, key));

    for (let i = 0; i < this.#keys.length; i++) {
      const signedBytes = BinaryUtil.binaryArrayToUint8Array(await KeyGrip.hmac(await this.sign(data, this.#keys[i]), key));

      if (
        signedBytes.byteLength === digestBytes.byteLength &&
        timingSafeEqual(digestBytes, signedBytes)
      ) {
        return i === 0 ? 'valid' : 'stale';
      }
    }
    return 'invalid';
  }
}
