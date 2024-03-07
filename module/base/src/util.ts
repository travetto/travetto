import crypto from 'node:crypto';
import timers from 'node:timers/promises';

import { ManifestFileUtil } from '@travetto/manifest';

type PromiseResolver<T> = { resolve: (v: T) => void, reject: (err?: unknown) => void };
type MapFn<T, U> = (val: T, i: number) => U | Promise<U>;

/**
 * Grab bag of common utilities
 */
export class Util {

  /**
   * Generate a random UUID
   * @param len The length of the uuid to generate
   */
  static uuid(len: number = 32): string {
    const bytes = crypto.randomBytes(Math.ceil(len / 2));
    // eslint-disable-next-line no-bitwise
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // eslint-disable-next-line no-bitwise
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return bytes.toString('hex').substring(0, len);
  }

  /**
   * Generate a proper sha512 hash from a src value
   * @param src The seed value to build the hash from
   * @param len The optional length of the hash to generate
   */
  static fullHash(src: string, len: number = -1): string {
    const hash = crypto.createHash('sha512');
    hash.update(src);
    const ret = hash.digest('hex');
    return len > 0 ? ret.substring(0, len) : ret;
  }

  /**
   * Generate a short hash from a src value, based on sha512
   * @param src The seed value to build the hash from
   */
  static shortHash(src: string): string {
    return this.fullHash(src, 32);
  }

  /**
   * Naive hashing
   */
  static naiveHash(text: string): number {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  /**
   * Produce a promise that is externally resolvable
   */
  static resolvablePromise<T = void>(): Promise<T> & PromiseResolver<T> {
    let ops: PromiseResolver<T>;
    const prom = new Promise<T>((resolve, reject) => ops = { resolve, reject });
    return Object.assign(prom, ops!);
  }

  /**
   * Map an async iterable with various mapping functions
   */
  static mapAsyncItr<T, U, V, W>(source: AsyncIterable<T>, fn1: MapFn<T, U>, fn2: MapFn<U, V>, fn3: MapFn<V, W>): AsyncIterable<W>;
  static mapAsyncItr<T, U, V>(source: AsyncIterable<T>, fn1: MapFn<T, U>, fn2: MapFn<U, V>): AsyncIterable<V>;
  static mapAsyncItr<T, U>(source: AsyncIterable<T>, fn: MapFn<T, U>): AsyncIterable<U>;
  static async * mapAsyncItr<T>(source: AsyncIterable<T>, ...fns: MapFn<unknown, unknown>[]): AsyncIterable<unknown> {
    let idx = -1;
    for await (const el of source) {
      if (el !== undefined) {
        idx += 1;
        let m = el;
        for (const fn of fns) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          m = (await fn(m, idx)) as typeof m;
        }
        yield m;
      }
    }
  }

  /**
   * Write file and copy over when ready
   */
  static async bufferedFileWrite(file: string, content: string | object): Promise<string> {
    return ManifestFileUtil.bufferedFileWrite(file, content);
  }

  /**
   * Non-blocking timeout
   */
  static nonBlockingTimeout(time: number): Promise<void> {
    return timers.setTimeout(time, undefined, { ref: false }).catch(() => { });
  }

  /**
   * Blocking timeout
   */
  static blockingTimeout(time: number): Promise<void> {
    return timers.setTimeout(time, undefined, { ref: true }).catch(() => { });
  }

  /**
   * Queue new macrotask
   */
  static queueMacroTask(): Promise<void> {
    return timers.setImmediate(undefined);
  }
}