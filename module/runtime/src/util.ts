import crypto from 'node:crypto';
import timers from 'node:timers/promises';

import { castTo } from './types.ts';
import { AppError } from './error.ts';

type MapFn<T, U> = (value: T, i: number) => U | Promise<U>;

type RunWithResultOptions = {
  run: (config: { signal: AbortSignal, iteration: number }) => Promise<unknown>;
  timeout?: number;
  maxRetries?: number
  restartDelay?: number;
  onRestart?: () => (unknown | Promise<unknown>);
  onFailure?: () => (unknown | Promise<unknown>);
  onInit?: (controller: AbortController) => Function;
}

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
   * @param length The length of the uuid to generate
   */
  static uuid(length: number = 32): string {
    const bytes = crypto.randomBytes(Math.ceil(length / 2));
    if (length === 32) { // Make valid uuid-v4
      // eslint-disable-next-line no-bitwise
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // eslint-disable-next-line no-bitwise
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
    }
    return bytes.toString('hex').substring(0, length);
  }

  /**
   * Map an async iterable with various mapping functions
   */
  static mapAsyncIterable<T, U, V, W>(source: AsyncIterable<T>, fn1: MapFn<T, U>, fn2: MapFn<U, V>, fn3: MapFn<V, W>): AsyncIterable<W>;
  static mapAsyncIterable<T, U, V>(source: AsyncIterable<T>, fn1: MapFn<T, U>, fn2: MapFn<U, V>): AsyncIterable<V>;
  static mapAsyncIterable<T, U>(source: AsyncIterable<T>, fn: MapFn<T, U>): AsyncIterable<U>;
  static async * mapAsyncIterable<T>(input: AsyncIterable<T>, ...fns: MapFn<unknown, unknown>[]): AsyncIterable<unknown> {
    let idx = -1;
    for await (const item of input) {
      if (item !== undefined) {
        idx += 1;
        let result = item;
        for (const fn of fns) {
          result = castTo(await fn(result, idx));
        }
        yield result;
      }
    }
  }

  /**
   * Map an async iterable with various mapping functions
   */
  static async * filterAsyncIterable<T>(input: AsyncIterable<T>, predicate: (input: T, index: number) => boolean): AsyncIterable<T> {
    let idx = -1;
    for await (const item of input) {
      if (predicate(item, idx += 1)) {
        yield item;
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

    const rawRules = (Array.isArray(rules) ? rules : rules.split(/,/g).map(rule => rule.trim()));
    const convertedRules = rawRules.map(rule => this.#allowDenyRuleInput(rule, convert));
    const unmatchedValue = !convertedRules.some(rule => rule.positive);

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
   * Retry an operation, with a custom conflict handler
   * @param operation The operation to retry
   * @param isHandledConflict Function to determine if the error is a handled conflict
   * @param maxTries Maximum number of retries
   */
  static async acquireWithRetry<T>(
    operation: () => T | Promise<T>,
    prepareRetry: (error: unknown, count: number) => (void | undefined | boolean | Promise<(void | undefined | boolean)>),
    maxTries = 5,
  ): Promise<T> {
    for (let i = 0; i < maxTries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxTries - 1 || await prepareRetry(error, i) === false) {
          throw error; // Stop retrying if we reached max tries or prepareRetry returns false
        }
      }
    }

    throw new AppError(`Operation failed after ${maxTries} attempts`);
  }


  /**
   * Run with restart capability
   */
  static async runWithRestart(config: RunWithResultOptions): Promise<void> {
    const timeout = config?.timeout ?? 10 * 1000;
    const restartDelay = config.restartDelay ?? 100;
    const iterations = new Array(config?.maxRetries ?? 10).fill(Date.now());
    const controller = new AbortController();
    const { signal } = controller;
    const cleanup = config.onInit?.(controller) ?? undefined;
    let timeoutExceeded = false;
    let result;
    let iteration = 0;

    while (!signal.aborted && !timeoutExceeded && result !== false) {

      if (iteration > 0) {
        await this.nonBlockingTimeout(restartDelay);
        await config?.onRestart?.();
      }

      iteration += 1;
      try {
        result = await config.run({ signal, iteration });
      } catch {
        // Error happened
      }

      iterations.push(Date.now());
      iterations.shift();
      timeoutExceeded = (Date.now() - iterations[0]) > timeout;
    }

    if (timeoutExceeded) {
      await config?.onFailure?.();
    }

    cleanup?.();
  }
}