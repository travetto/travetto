import { Class, ClassInstance, TypedObject, ObjectUtil } from '@travetto/base';

const REGEX_PAT = /[\/](.*)[\/](i|g|m|s)?/;

/**
 * Utilities for data conversion and binding
 */
export class DataUtil {

  static #deepAssignRaw(a: unknown, b: unknown, mode: 'replace' | 'loose' | 'strict' | 'coerce' = 'loose'): unknown {
    const isEmptyA = a === undefined || a === null;
    const isEmptyB = b === undefined || b === null;
    const isArrA = Array.isArray(a);
    const isArrB = Array.isArray(b);
    const isSimpA = !isEmptyA && ObjectUtil.isSimple(a);
    const isSimpB = !isEmptyB && ObjectUtil.isSimple(b);

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
        const match = `${input}`.match(/^((?<TRUE>true|yes|1|on)|false|no|off|0)$/i);
        if (strict && !match) {
          throw new Error(`Invalid boolean value: ${input}`);
        }
        return !!match?.groups?.TRUE;
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
        if (!strict || ObjectUtil.isPlainObject(input)) {
          return input;
        } else {
          throw new Error('Invalid object type');
        }
      }
      case undefined:
      case String: return `${input}`;
    }
    if (!strict || ObjectUtil.isPlainObject(input)) {
      return input;
    } else {
      throw new Error(`Unknown type ${type.name}`);
    }
  }

  /**
   * Clone top level properties to a new object
   * @param o Object to clone
   */
  static shallowClone<T = unknown>(a: T): T {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (Array.isArray(a) ? a.slice(0) : (ObjectUtil.isSimple(a) ? a : { ...(a as {}) })) as T;
  }

  /**
   * Deep assign from b to a
   * @param a The target
   * @param b The source
   * @param mode How the assignment should be handled
   */
  static deepAssign<T, U>(a: T, b: U, mode: | 'replace' | 'loose' | 'strict' | 'coerce' = 'loose'): T & U {
    if (!a || ObjectUtil.isSimple(a)) {
      throw new Error(`Cannot merge onto a simple value, ${a}`);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.#deepAssignRaw(a, b, mode) as T & U;
  }

  /**
   * Filter object by excluding specific keys
   * @param obj A value to filter, primitives will be untouched
   * @param exclude Strings or patterns to exclude against
   * @returns
   */
  static filterByKeys<T>(obj: T, exclude: (string | RegExp)[]): T {
    if (obj !== null && obj !== undefined && typeof obj === 'object') {
      const out: Partial<T> = {};
      for (const key of TypedObject.keys(obj)) {
        if (!exclude.some(r => typeof key === 'string' && (typeof r === 'string' ? r === key : r.test(key)))) {
          const val = obj[key];
          if (typeof val === 'object') {
            out[key] = this.filterByKeys(val, exclude);
          } else {
            out[key] = val;
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return out as T;
    } else {
      return obj;
    }
  }

}