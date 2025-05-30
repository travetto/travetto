import crypto from 'node:crypto';
import timers from 'node:timers/promises';

import { castTo, hasToJSON } from './types.ts';
import { AppError } from './error.ts';

type MapFn<T, U> = (val: T, i: number) => U | Promise<U>;

/**
 * Grab bag of common utilities
 */
export class Util {

  static #match<T, K extends unknown[]>(
    rules: { value: T, positive: boolean }[],
    compare: (rule: T, ...compareInput: K) => boolean,
    unmatchedValue: boolean,
    ...input: K
  ): boolean {
    for (const rule of rules) {
      if (compare(rule.value, ...input)) {
        return rule.positive;
      }
    }
    return unmatchedValue;
  }

  static #allowDenyRuleInput<T>(
    rule: (string | T | [value: T, positive: boolean] | [value: T]),
    convert: (inputRule: string) => T
  ): { value: T, positive: boolean } {
    return typeof rule === 'string' ?
      { value: convert(rule.replace(/^!/, '')), positive: !rule.startsWith('!') } :
      Array.isArray(rule) ?
        { value: rule[0], positive: rule[1] ?? true } :
        { value: rule, positive: true };
  }

  /**
   * Generate a random UUID
   * @param len The length of the uuid to generate
   */
  static uuid(len: number = 32): string {
    const bytes = crypto.randomBytes(Math.ceil(len / 2));
    if (len === 32) { // Make valid uuid-v4
      // eslint-disable-next-line no-bitwise
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // eslint-disable-next-line no-bitwise
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
    }
    return bytes.toString('hex').substring(0, len);
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
          m = castTo(await fn(m, idx));
        }
        yield m;
      }
    }
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
   * Queue new macro task
   */
  static queueMacroTask(): Promise<void> {
    return timers.setImmediate(undefined);
  }

  /**
   * Simple check against allow/deny rules
   * @param rules
   */
  static allowDeny<T, K extends unknown[]>(
    rules: string | (string | T | [value: T, positive: boolean])[],
    convert: (rule: string) => T,
    compare: (rule: T, ...compareInput: K) => boolean,
    cacheKey?: (...keyInput: K) => string
  ): (...input: K) => boolean {

    const rawRules = (Array.isArray(rules) ? rules : rules.split(/,/g).map(x => x.trim()));
    const convertedRules = rawRules.map(rule => this.#allowDenyRuleInput(rule, convert));
    const unmatchedValue = !convertedRules.some(r => r.positive);

    if (convertedRules.length) {
      if (cacheKey) {
        const cache: Record<string, boolean> = {};
        return (...input: K) =>
          cache[cacheKey(...input)] ??= this.#match(convertedRules, compare, unmatchedValue, ...input);
      } else {
        return (...input: K) => this.#match(convertedRules, compare, unmatchedValue, ...input);
      }
    } else {
      return () => true;
    }
  }

  /**
   * Encode JSON value as base64 encoded string
   */
  static encodeSafeJSON<T>(value: T | undefined): string | undefined {
    if (value === undefined) {
      return;
    }
    const res = JSON.stringify(value);
    return Buffer.from(res, 'utf8').toString('base64');
  }

  /**
   * Decode JSON value from base64 encoded string
   */
  static decodeSafeJSON<T>(input: string): T;
  static decodeSafeJSON<T>(input?: string | undefined): T | undefined;
  static decodeSafeJSON<T>(input?: string | undefined): T | undefined {
    if (!input) {
      return undefined;
    }

    let decoded = Buffer.from(input, 'base64').toString('utf8');

    // Read from encoded if it happens
    if (decoded.startsWith('%')) {
      decoded = decodeURIComponent(decoded);
    }

    return JSON.parse(decoded, undefined);
  }

  /**
   * Serialize to JSON
   */
  static serializeToJSON<T>(out: T): string {
    return JSON.stringify(out, function (k, v) {
      const ov = this[k];
      if (ov && ov instanceof Error) {
        return {
          $: true,
          ...hasToJSON(ov) ? ov.toJSON() : ov,
          name: ov.name,
          message: ov.message,
          stack: ov.stack,
        };
      } else if (typeof v === 'bigint') {
        return `${v.toString()}$n`;
      } else {
        return v;
      }
    });
  }

  /**
   * Deserialize from JSON
   */
  static deserializeFromJson<T = unknown>(input: string): T {
    return JSON.parse(input, function (k, v) {
      if (v && typeof v === 'object' && '$' in v) {
        const err = AppError.fromJSON(v) ?? new Error();
        if (!(err instanceof AppError)) {
          const { $: _, ...rest } = v;
          Object.assign(err, rest);
        }
        err.message = v.message;
        err.stack = v.stack;
        err.name = v.name;
        return err;
      } else if (typeof v === 'string' && /^\d+[$]n$/.test(v)) {
        return BigInt(v.split('$')[0]);
      } else {
        return v;
      }
    });
  }

  /**
   * Retry an operation, with a custom conflict handler
   * @param op The operation to retry
   * @param isHandledConflict Function to determine if the error is a handled conflict
   * @param maxTries Maximum number of retries
   */
  static async acquireWithRetry<T>(
    op: () => T | Promise<T>,
    prepareRetry: (err: unknown, count: number) => (void | undefined | boolean | Promise<(void | undefined | boolean)>),
    maxTries = 5,
  ): Promise<T> {
    for (let i = 0; i < maxTries; i++) {
      try {
        return await op();
      } catch (err) {
        if (i === maxTries - 1 || await prepareRetry(err, i) === false) {
          throw err; // Stop retrying if we reached max tries or prepareRetry returns false
        }
      }
    }

    throw new AppError(`Operation failed after ${maxTries} attempts`);
  }
}