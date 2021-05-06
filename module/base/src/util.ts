import * as crypto from 'crypto';
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


/**
 * Common utilities for object detection/manipulation
 */
export class Util {
  static #timePattern = new RegExp(`^(-?[0-9.]+)(${Object.keys(TIME_UNITS).join('|')})$`);

  static #deepAssignRaw(a: unknown, b: unknown, mode: 'replace' | 'loose' | 'strict' | 'coerce' = 'loose') {
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
          const retArr = ret as unknown[];
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
            ret = this.coerceType(b, (a as ClassInstance).constructor, false);
          }
        }
      } else { // Object merge
        ret = a;
        const bObj = b as Record<string, unknown>;
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
  static hasToJSON = (o: unknown): o is { toJSON(): unknown } => !!o && 'toJSON' in (o as object);

  /**
   * Create regex from string, including flags
   * @param input Convert input to a regex
   */
  static toRegex(input: string | RegExp) {
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
  static coerceType(input: unknown, type: Class<unknown>, strict = true) {
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
          } catch (err) {
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
  static shallowClone(a: unknown) {
    return Array.isArray(a) ? a.slice(0) : (this.isSimple(a) ? a : { ...(a as {}) });
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
    return proto && (proto === Function.prototype || proto.constructor.name === 'AsyncFunction');
  }

  /**
   * Is a value a class
   * @param o Object to check
   */
  static isClass(o: unknown) {
    return !!(o as object) && !!(o as { prototype: unknown }).prototype &&
      (o as { prototype: { constructor: unknown } }).prototype.constructor !== Object.getPrototypeOf(Function);
  }

  /**
   * Is simple, as a primitive, function or class
   */
  static isSimple(a: unknown) {
    return this.isPrimitive(a) || this.isFunction(a) || this.isClass(a);
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
    return this.#deepAssignRaw(a, b, mode) as T & U;
  }

  /**
   * Generate a random UUID
   * @param len The length of the uuid to generate
   */
  static uuid(len: number = 32) {
    const bytes = crypto.randomBytes(Math.ceil(len / 2));
    // eslint-disable-next-line no-bitwise
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // eslint-disable-next-line no-bitwise
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return bytes.toString('hex').substring(0, len);
  }

  /**
   * Produce a promise that is externally resolvable
   */
  static resolvablePromise<T = void>() {
    let ops: { resolve: (v?: T) => void, reject: (err?: unknown) => void };
    const prom = new Promise((resolve, reject) => ops = { resolve, reject });
    Object.assign(prom, ops!);
    return prom as Promise<T> & (typeof ops);
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
  static timeToMs(amount: number | TimeSpan, unit?: TimeUnit) {
    if (typeof amount === 'string') {
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
  static timeFromNow(age: number | TimeSpan, unit?: TimeUnit) {
    return new Date(Date.now() + this.timeToMs(age, unit));
  }

  /**
   * Wait for n units of time
   */
  static wait(n: number | TimeSpan, unit?: TimeUnit) {
    return new Promise(res => setTimeout(res, this.timeToMs(n, unit)));
  }

  /**
   * Get environment variable as time
   * @param key env key
   * @param def backup value if not valid or found
   */
  static getEnvTime(key: string, def?: number | TimeSpan) {
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
}