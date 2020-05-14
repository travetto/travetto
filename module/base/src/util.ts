import * as crypto from 'crypto';

const REGEX_PAT = /[\/](.*)[\/](i|g|m|s)?/;

/**
 * Common utilities for object detection/manipulation
 */
export class Util {
  private static deepAssignRaw(a: any, b: any, mode: 'replace' | 'loose' | 'strict' | 'coerce' = 'loose') {
    const isEmptyA = a === undefined || a === null;
    const isEmptyB = b === undefined || b === null;
    const isArrA = Array.isArray(a);
    const isArrB = Array.isArray(b);
    const isSimpA = !isEmptyA && this.isSimple(a);
    const isSimpB = !isEmptyB && this.isSimple(b);

    let ret: any;

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
          for (let i = 0; i < b.length; i++) {
            ret[i] = this.deepAssignRaw(ret[i], b[i], mode);
          }
        }
      } else if (isSimpB) { // Scalars
        const match = typeof a === typeof b;
        ret = b;

        if (!match) { // If types do not match
          if (mode === 'strict') { // Bail on strict
            throw new Error(`Cannot merge ${a} [${typeof a}] with ${b} [${typeof b}]`);
          } else if (mode === 'coerce') { // Force on coerce
            ret = this.coerceType(b, a.constructor, false);
          }
        }
      } else { // Object merge
        ret = a;

        for (const key of Object.keys(b)) {
          ret[key] = this.deepAssignRaw(ret[key], b[key], mode);
        }
      }
    }
    return ret;
  }

  /**
   * Has to JSON
   */
  static hasToJSON = (o: any): o is { toJSON(): any } => 'toJSON' in o;

  /**
   * Create regex from string, including flags
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
  static coerceType(input: any, type: typeof String, strict?: boolean): string;
  static coerceType(input: any, type: typeof Number, strict?: boolean): number;
  static coerceType(input: any, type: typeof Boolean, strict?: boolean): boolean;
  static coerceType(input: any, type: typeof Date, strict?: boolean): Date;
  static coerceType(input: any, type: typeof RegExp, strict?: boolean): RegExp;
  static coerceType<T>(input: any, type: { new(...args: any[]): T }, strict?: boolean): T;
  static coerceType(input: any, type: any, strict = true) {
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
          new Date(parseInt(input, 10)) : new Date(input);
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
   */
  static shallowClone(a: any) {
    return Array.isArray(a) ? a.slice(0) : (this.isSimple(a) ? a : { ...a });
  }

  /**
   * Is a value of primitive type
   */
  static isPrimitive(el: any): el is (string | boolean | number | RegExp) {
    const type = typeof el;
    return el !== null && el !== undefined && (type === 'string' || type === 'boolean' || type === 'number' || el instanceof RegExp || el instanceof Date);
  }

  /**
   * Is a value a plain JS object, created using {}
   */
  static isPlainObject(obj: any): obj is Record<string, any> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  /**
   * Is a value a function
   */
  static isFunction(o: any): o is Function {
    const proto = o && Object.getPrototypeOf(o);
    return proto && (proto === Function.prototype || proto.constructor.name === 'AsyncFunction');
  }

  /**
   * Is a value a class
   */
  static isClass(o: any) {
    return o && o.prototype && o.prototype.constructor !== Object.getPrototypeOf(Function);
  }

  /**
   * Is simple, as a primitive, function or class
   */
  static isSimple(a: any) {
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
    return this.deepAssignRaw(a, b, mode) as T & U;
  }

  /**
   * Generate a random UUID
   */
  static uuid(len: number = 32) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').substring(0, len);
  }

  /**
   * Produce a promise that is externally resolvable
   */
  static resolvablePromise<T = void>() {
    let ops: { resolve: (v: T) => void, reject: (err: Error) => void };
    const prom = new Promise((resolve, reject) => ops = { resolve, reject });
    Object.assign(prom, ops!);
    return prom as Promise<T> & (typeof ops);
  }
}