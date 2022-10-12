import * as timers from 'timers/promises';

import { EnvUtil } from '@travetto/boot';
import { Class, ClassInstance } from './types';

const REGEX_PAT = /[\/](.*)[\/](i|g|m|s)?/;

const MIN = 1000 * 60;
const DAY = 24 * MIN * 60;
const TIME_UNITS = {
  y: DAY * 365,
  M: DAY * 30,
  w: DAY * 7,
  d: DAY,
  h: MIN * 60,
  m: MIN,
  s: 1000,
  ms: 1
};

export type TimeSpan = `${number}${keyof typeof TIME_UNITS}`;
export type TimeUnit = keyof typeof TIME_UNITS;

type PromiseResolver<T> = { resolve: (v: T) => void, reject: (err?: unknown) => void };

const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () { });
const GeneratorFunction = Object.getPrototypeOf(function* () { });
const AsyncFunction = Object.getPrototypeOf(async function () { });

/**
 * Common utilities for object detection/manipulation
 */
export class Util {
  static #timePattern = new RegExp(`^(-?[0-9.]+)(${Object.keys(TIME_UNITS).join('|')})$`);

  static #deepAssignRaw(a: unknown, b: unknown, mode: 'replace' | 'loose' | 'strict' | 'coerce' = 'loose'): unknown {
    const isEmptyA = a === undefined || a === null;
    const isEmptyB = b === undefined || b === null;
    const isArrA = Array.isArray(a);
    const isArrB = Array.isArray(b);
    const isSimpA = !isEmptyA && this.isSimple(a);
    const isSimpB = !isEmptyB && this.isSimple(b);

    let ret: unknown;

    if (isEmptyA || isEmptyB) { // If no `a`, `b` always wins
      if (mode === 'replace' || b === null || !isEmptyB) {
        ret = isEmptyB ? b : this.shallowClone(b);
      } else if (!isEmptyA) {
        ret = this.shallowClone(a);
      } else {
        ret = undefined;
      }
    } else {
      if (isArrA !== isArrB || isSimpA !== isSimpB) {
        throw new Error(`Cannot merge differing types ${a} and ${b}`);
      }
      if (isArrB) { // Arrays
        ret = a; // Write onto A
        if (mode === 'replace') {
          ret = b;
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const retArr = ret as unknown[];
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const bArr = b as unknown[];
          for (let i = 0; i < bArr.length; i++) {
            retArr[i] = this.#deepAssignRaw(retArr[i], bArr[i], mode);
          }
        }
      } else if (isSimpB) { // Scalars
        const match = typeof a === typeof b;
        ret = b;

        if (!match) { // If types do not match
          if (mode === 'strict') { // Bail on strict
            throw new Error(`Cannot merge ${a} [${typeof a}] with ${b} [${typeof b}]`);
          } else if (mode === 'coerce') { // Force on coerce
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ret = this.coerceType(b, (a as ClassInstance).constructor, false);
          }
        }
      } else { // Object merge
        ret = a;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const bObj = b as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const retObj = ret as Record<string, unknown>;

        for (const key of Object.keys(bObj)) {
          retObj[key] = this.#deepAssignRaw(retObj[key], bObj[key], mode);
        }
      }
    }
    return ret;
  }

  /**
   * Has to JSON
   * @param o Object to check
   */
  static hasToJSON = (o: unknown): o is { toJSON(): unknown } =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    !!o && 'toJSON' in (o as object);

  /**
   * Create regex from string, including flags
   * @param input Convert input to a regex
   */
  static toRegex(input: string | RegExp): RegExp {
    if (input instanceof RegExp) {
      return input;
    } else if (REGEX_PAT.test(input)) {
      const [, pat, mod] = input.match(REGEX_PAT) ?? [];
      return new RegExp(pat, mod);
    } else {
      return new RegExp(input);
    }
  }

  /**
   * Coerce an input of any type to the class provided
   * @param input Input value
   * @param type Class to coerce to (String, Boolean, Number, Date, RegEx, Object)
   * @param strict Should a failure to coerce throw an error?
   */
  static coerceType(input: unknown, type: typeof String, strict?: boolean): string;
  static coerceType(input: unknown, type: typeof Number, strict?: boolean): number;
  static coerceType(input: unknown, type: typeof Boolean, strict?: boolean): boolean;
  static coerceType(input: unknown, type: typeof Date, strict?: boolean): Date;
  static coerceType(input: unknown, type: typeof RegExp, strict?: boolean): RegExp;
  static coerceType<T>(input: unknown, type: Class<T>, strict?: boolean): T;
  static coerceType(input: unknown, type: Class<unknown>, strict = true): unknown {
    // Do nothing
    if (input === null || input === undefined) {
      return input;
    } else if (!strict && type !== String && input === '') {
      return undefined; // treat empty string as undefined for non-strings in non-strict mode
    } else if (type && input instanceof type) {
      return input;
    }

    switch (type) {
      case Date: {
        const res = typeof input === 'number' || /^[-]?\d+$/.test(`${input}`) ?
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          new Date(parseInt(input as string, 10)) : new Date(input as Date);
        if (strict && Number.isNaN(res.getTime())) {
          throw new Error(`Invalid date value: ${input}`);
        }
        return res;
      }
      case Number: {
        const res = `${input}`.includes('.') ? parseFloat(`${input}`) : parseInt(`${input}`, 10);
        if (strict && Number.isNaN(res)) {
          throw new Error(`Invalid numeric value: ${input}`);
        }
        return res;
      }
      case Boolean: {
        const res = /^(true|yes|1|on)$/i.test(`${input}`);
        if (strict && !/^(false|no|off|0|true|yes|on|1)$/i.test(`${input}`)) {
          throw new Error(`Invalid boolean value: ${input}`);
        }
        return res;
      }
      case RegExp: {
        if (typeof input === 'string') {
          try {
            return this.toRegex(input);
          } catch {
            if (strict) {
              throw new Error(`Invalid regex: ${input}`);
            } else {
              return;
            }
          }
        } else if (strict) {
          throw new Error('Invalid regex type');
        } else {
          return;
        }
      }
      case Object: {
        if (!strict || this.isPlainObject(input)) {
          return input;
        } else {
          throw new Error('Invalid object type');
        }
      }
      case undefined:
      case String: return `${input}`;
    }
    throw new Error(`Unknown type ${type.name}`);
  }

  /**
   * Clone top level properties to a new object
   * @param o Object to clone
   */
  static shallowClone<T = unknown>(a: T): T {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (Array.isArray(a) ? a.slice(0) : (this.isSimple(a) ? a : { ...(a as {}) })) as T;
  }

  /**
   * Is a value of primitive type
   * @param el Value to check
   */
  static isPrimitive(el: unknown): el is (string | boolean | number | RegExp) {
    const type = typeof el;
    return el !== null && el !== undefined && (type === 'string' || type === 'boolean' || type === 'number' || el instanceof RegExp || el instanceof Date);
  }

  /**
   * Is a value a plain JS object, created using {}
   * @param obj Object to check
   */
  static isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  /**
   * Is a value a function
   * @param o Object to check
   */
  static isFunction(o: unknown): o is Function {
    const proto = o && Object.getPrototypeOf(o);
    return proto && (proto === Function.prototype || proto === AsyncFunction || proto === AsyncGeneratorFunction || proto === GeneratorFunction);
  }

  /**
   * Is a value a class
   * @param o Object to check
   */
  static isClass(o: unknown): o is Class {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return !!(o as object) && !!(o as { prototype: unknown }).prototype &&
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (o as { prototype: { constructor: unknown } }).prototype.constructor !== Object.getPrototypeOf(Function);
  }

  /**
   * Is simple, as a primitive, function or class
   */
  static isSimple(a: unknown): a is Function | Class | string | number | RegExp | Date {
    return this.isPrimitive(a) || this.isFunction(a) || this.isClass(a);
  }

  /**
   * Is an error object
   */
  static isError(a: unknown): a is Error {
    return !!a && (a instanceof Error || (typeof a === 'object' && 'message' in a && 'stack' in a));
  }

  /**
   * Is a promise object
   */
  static isPromise(a: unknown): a is Promise<unknown> {
    return !!a && (a instanceof Promise || (typeof a === 'object') && 'then' in a);
  }

  /**
   * Deep assign from b to a
   * @param a The target
   * @param b The source
   * @param mode How the assignment should be handled
   */
  static deepAssign<T, U>(a: T, b: U, mode: | 'replace' | 'loose' | 'strict' | 'coerce' = 'loose'): T & U {
    if (!a || this.isSimple(a)) {
      throw new Error(`Cannot merge onto a simple value, ${a}`);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.#deepAssignRaw(a, b, mode) as T & U;
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
   * Test to see if a string is valid for relative time
   * @param val
   */
  static isTimeSpan(val: string): val is TimeSpan {
    return this.#timePattern.test(val);
  }

  /**
   * Returns time units convert to ms
   * @param amount Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static timeToMs(amount: number | TimeSpan, unit?: TimeUnit): number {
    if (typeof amount === 'string') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      [, amount, unit] = amount.match(this.#timePattern) as [undefined, '1m', 'm'] ?? [undefined, amount, unit];
      if (!TIME_UNITS[unit]) {
        return NaN;
      }
      amount = amount.includes('.') ? parseFloat(amount) : parseInt(amount, 10);
    }
    return amount * TIME_UNITS[unit ?? 'ms'];
  }

  /**
   * Returns a new date with `age` units into the future
   * @param age Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static timeFromNow(age: number | TimeSpan, unit?: TimeUnit): Date {
    return new Date(Date.now() + this.timeToMs(age, unit));
  }

  /**
   * Wait for n units of time
   */
  static wait(n: number | TimeSpan, unit?: TimeUnit): Promise<void> {
    return timers.setTimeout(this.timeToMs(n, unit));
  }

  /**
   * Get environment variable as time
   * @param key env key
   * @param def backup value if not valid or found
   */
  static getEnvTime(key: string, def?: number | TimeSpan): number {
    const val = EnvUtil.get(key);
    let ms: number | undefined;
    if (val) {
      if (this.isTimeSpan(val)) {
        ms = this.timeToMs(val);
      } else if (!Number.isNaN(+val)) {
        ms = +val;
      }
    }
    return ms ?? (def ? this.timeToMs(def) : NaN);
  }


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
   * Simple check against allow/deny rules
   * @param rules
   */
  static allowDenyMatcher<T, K extends unknown[]>(
    rules: string | (string | T | [value: T, positive: boolean])[],
    convert: (rule: string) => T,
    compare: (rule: T, ...compareInput: K) => boolean,
    cacheKey?: (...keyInput: K) => string
  ): (...input: K) => boolean {

    const rawRules = (Array.isArray(rules) ? rules : rules.split(/\s*,\s*/g));
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
}