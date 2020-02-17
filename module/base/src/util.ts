import * as crypto from 'crypto';

const REGEX_PAT = /[\/](.*)[\/](i|g|m|s)?/;

export class Util {
  private static extractRegex(val: string | RegExp): RegExp {
    let out: RegExp;
    if (typeof val === 'string') {
      if (REGEX_PAT.test(val)) {
        const [, pat, mod] = val.match(REGEX_PAT) ?? [];
        out = new RegExp(pat, mod);
      } else {
        out = new RegExp(val);
      }
    } else {
      out = val;
    }
    return out;
  }

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

  static coerceType(input: any, type: typeof String, strict?: boolean): string;
  static coerceType(input: any, type: typeof Number, strict?: boolean): number;
  static coerceType(input: any, type: typeof Boolean, strict?: boolean): boolean;
  static coerceType(input: any, type: typeof Date, strict?: boolean): Date;
  static coerceType(input: any, type: typeof RegExp, strict?: boolean): RegExp;
  static coerceType<T>(input: any, type: { new(...args: any[]): T }, strict?: boolean): T;
  static coerceType(input: any, type: any, strict = true) {
    // Do nothing
    if (
      input === null ||
      input === undefined ||
      (type && input instanceof type)
    ) {
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
        const res = `${input}`.indexOf('.') >= 0 ? parseFloat(`${input}`) : parseInt(`${input}`, 10);
        if (strict && Number.isNaN(res)) {
          throw new Error(`Invalid numeric value: ${input}`);
        }
        return res;
      }
      case Boolean: {
        const res = /^(true|yes|1|on)$/.test(`${input}`);
        if (strict && !/^(false|no|off|0|true|yes|on|1)$/i.test(input)) {
          throw new Error(`Invalid boolean value: ${input}`);
        }
        return res;
      }
      case RegExp: {
        try {
          return this.extractRegex(input);
        } catch (err) {
          if (strict) {
            throw err;
          } else {
            return;
          }
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

  static shallowClone(a: any) {
    return Array.isArray(a) ? a.slice(0) : (this.isSimple(a) ? a : { ...a });
  }

  static isPrimitive(el: any): el is (string | boolean | number | RegExp) {
    const type = typeof el;
    return el !== null && el !== undefined && (type === 'string' || type === 'boolean' || type === 'number' || el instanceof RegExp || el instanceof Date);
  }

  static isPlainObject(obj: any): obj is Record<string, any> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  static isFunction(o: any): o is Function {
    const proto = o && Object.getPrototypeOf(o);
    return proto && (proto === Function.prototype || proto.constructor.name === 'AsyncFunction');
  }

  static isClass(o: any) {
    return o && o.prototype && o.prototype.constructor !== Object.getPrototypeOf(Function);
  }

  static isSimple(a: any) {
    return this.isPrimitive(a) || this.isFunction(a) || this.isClass(a);
  }

  static deepAssign<T extends any, U extends any>(a: T, b: U, mode: | 'replace' | 'loose' | 'strict' | 'coerce' = 'loose'): T & U {
    if (!a || this.isSimple(a)) {
      throw new Error(`Cannot merge onto a simple value, ${a}`);
    }
    return this.deepAssignRaw(a, b, mode) as T & U;
  }

  static uuid(len: number = 32) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').substring(0, len);
  }
}