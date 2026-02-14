import { isNumberObject, isBooleanObject, isStringObject } from 'node:util/types';

import { asConstructable, castTo, type Class, asFull, TypedObject } from '@travetto/runtime';
import { UnknownType } from './types.ts';

const REGEX_PATTERN = /[\/](.*)[\/](i|g|m|s)?/;

/**
 * Utilities for data conversion and binding
 */
export class DataUtil {

  /**
   * Is a value a plain JS object, created using {}
   * @param value Object to check
   */
  static isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' // separate from primitives
      && value !== undefined
      && value !== null         // is obvious
      && value.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(value) === '[object Object]'; // separate build-in like Math
  }

  /**
   * Is a value of primitive type
   * @param value Value to check
   */
  static isPrimitive(value: unknown): value is (string | boolean | number | RegExp) {
    switch (typeof value) {
      case 'string': case 'boolean': case 'number': case 'bigint': return true;
      case 'object': return !!value && (
        value instanceof RegExp || value instanceof Date || isStringObject(value) || isNumberObject(value) || isBooleanObject(value)
      );
      default: return false;
    }
  }

  /**
   * Is simple, as a primitive, function or class
   */
  static isSimpleValue(value: unknown): value is Function | Class | string | number | RegExp | Date {
    return this.isPrimitive(value) || typeof value === 'function';
  }

  static #deepAssignRaw(a: unknown, b: unknown, mode: 'replace' | 'loose' | 'strict' | 'coerce' = 'loose'): unknown {
    const isEmptyA = a === undefined || a === null;
    const isEmptyB = b === undefined || b === null;
    const isArrA = Array.isArray(a);
    const isArrB = Array.isArray(b);
    const isSimpA = !isEmptyA && this.isSimpleValue(a);
    const isSimpB = !isEmptyB && this.isSimpleValue(b);

    let value: unknown;

    if (isEmptyA || isEmptyB) { // If no `a`, `b` always wins
      if (mode === 'replace' || b === null || !isEmptyB) {
        value = isEmptyB ? b : this.shallowClone(b);
      } else if (!isEmptyA) {
        value = this.shallowClone(a);
      } else {
        value = undefined;
      }
    } else {
      if (isArrA !== isArrB || isSimpA !== isSimpB) {
        throw new Error(`Cannot merge differing types ${a} and ${b}`);
      }
      if (Array.isArray(b)) { // Arrays
        value = a; // Write onto A
        if (mode === 'replace') {
          value = b;
        } else {
          const valueArray: unknown[] = castTo(value);
          const bArray = b;
          for (let i = 0; i < bArray.length; i++) {
            valueArray[i] = this.#deepAssignRaw(valueArray[i], bArray[i], mode);
          }
        }
      } else if (isSimpB) { // Scalars
        const match = typeof a === typeof b;
        value = b;

        if (!match) { // If types do not match
          if (mode === 'strict') { // Bail on strict
            throw new Error(`Cannot merge ${a} [${typeof a}] with ${b} [${typeof b}]`);
          } else if (mode === 'coerce') { // Force on coerce
            value = this.coerceType(b, asConstructable(a).constructor, false);
          }
        }
      } else { // Object merge
        value = a;
        const bObject: Record<string, unknown> = castTo(b);
        const valueObject: Record<string, unknown> = castTo(value);

        for (const key of Object.keys(bObject)) {
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
          }
          valueObject[key] = this.#deepAssignRaw(valueObject[key], bObject[key], mode);
        }
      }
    }
    return value;
  }

  /**
   * Create regex from string, including flags
   * @param input Convert input to a regex
   */
  static toRegex(input: string | RegExp): RegExp {
    if (input instanceof RegExp) {
      return input;
    } else if (REGEX_PATTERN.test(input)) {
      const [, pattern, module] = input.match(REGEX_PATTERN) ?? [];
      return new RegExp(pattern, module);
    } else {
      return new RegExp(input);
    }
  }

  /**
   * Coerce an input of any type to the class provided
   * @param input Input value
   * @param type Class to coerce to (String, Boolean, Number, Date, RegExp, Object)
   * @param strict Should a failure to coerce throw an error?
   */
  static coerceType(input: unknown, type: typeof String, strict?: boolean): string;
  static coerceType(input: unknown, type: typeof Number, strict?: boolean): number;
  static coerceType(input: unknown, type: typeof BigInt, strict?: boolean): bigint;
  static coerceType(input: unknown, type: typeof Boolean, strict?: boolean): boolean;
  static coerceType(input: unknown, type: typeof Date, strict?: boolean): Date;
  static coerceType(input: unknown, type: typeof RegExp, strict?: boolean): RegExp;
  static coerceType(input: unknown, type: typeof UnknownType, strict?: boolean): unknown;
  static coerceType<T>(input: unknown, type: Class<T> | Function, strict?: boolean): T;
  static coerceType(input: unknown, type: Class<unknown> | Function, strict = true): unknown {
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
        let value: Date | undefined;
        if (typeof input === 'object' && 'toDate' in input && typeof input.toDate === 'function') {
          value = castTo(input.toDate());
        } else {
          value = input instanceof Date ?
            input :
            typeof input === 'number' ?
              new Date(input) :
              typeof input === 'bigint' ?
                new Date(Number(input)) :
                (typeof input === 'string' && /^[-]?\d+$/.test(input)) ?
                  new Date(parseInt(input, 10)) :
                  new Date(input.toString());
        }
        if (strict && value && Number.isNaN(value.getTime())) {
          throw new Error(`Invalid date value: ${input}`);
        }
        return value;
      }
      case Number: {
        if (typeof input === 'bigint') {
          return Number(input);
        }
        const value = `${input}`.includes('.') ? parseFloat(`${input}`) : parseInt(`${input}`, 10);
        if (strict && Number.isNaN(value)) {
          throw new Error(`Invalid numeric value: ${input}`);
        }
        return value;
      }
      case BigInt: {
        if (typeof input === 'bigint') {
          return input;
        }
        try {
          return BigInt((typeof input === 'boolean' || typeof input === 'number') ?
            input : `${input}`.replace(/n$/i, ''));
        } catch {
          if (strict) {
            throw new Error(`Invalid numeric value: ${input}`);
          }
          return;
        }
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
      case UnknownType: {
        return input;
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
    if (!strict || this.isPlainObject(input)) {
      return input;
    } else {
      throw new Error(`Unknown type ${type.name}`);
    }
  }

  /**
   * Clone top level properties to a new object
   * @param value Object to clone
   */
  static shallowClone<T>(value: T): T {
    return castTo(Array.isArray(value) ? value.slice(0) : (this.isSimpleValue(value) ? value : { ...castTo<object>(value) }));
  }

  /**
   * Deep assign from b to a
   * @param a The target
   * @param b The source
   * @param mode How the assignment should be handled
   */
  static deepAssign<T, U>(a: T, b: U, mode: | 'replace' | 'loose' | 'strict' | 'coerce' = 'loose'): T & U {
    if (!a || this.isSimpleValue(a)) {
      throw new Error(`Cannot merge onto a simple value, ${a}`);
    }
    return castTo(this.#deepAssignRaw(a, b, mode));
  }

  /**
   * Filter object by excluding specific keys
   * @param input A value to filter, primitives will be untouched
   * @param exclude Strings or patterns to exclude against
   * @returns
   */
  static filterByKeys<T>(input: T, exclude: (string | RegExp)[]): T {
    if (Array.isArray(input)) {
      return castTo(input.map(value => this.filterByKeys(value, exclude)));
    } else if (input !== null && input !== undefined && typeof input === 'object') {
      const out: Partial<T> = {};
      for (const key of TypedObject.keys(input)) {
        if (!exclude.some(toMatch => typeof key === 'string' && (typeof toMatch === 'string' ? toMatch === key : toMatch.test(key)))) {
          const value = input[key];
          if (typeof value === 'object') {
            out[key] = this.filterByKeys(value, exclude);
          } else {
            out[key] = value;
          }
        }
      }
      return asFull(out);
    } else {
      return input;
    }
  }
}