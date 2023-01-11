import { Class } from './types';

const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () { });
const GeneratorFunction = Object.getPrototypeOf(function* () { });
const AsyncFunction = Object.getPrototypeOf(async function () { });

/**
 * Common utilities for object detection/manipulation
 */
export class ObjectUtil {

  /**
   * Has to JSON
   * @param o Object to check
   */
  static hasToJSON = (o: unknown): o is { toJSON(): unknown } =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    !!o && 'toJSON' in (o as object);

  /**
   * Is a value of primitive type
   * @param el Value to check
   */
  static isPrimitive(el: unknown): el is (string | boolean | number | RegExp) {
    const type = typeof el;
    return el !== null && el !== undefined && (type === 'string' || type === 'boolean' || type === 'number' ||
      el instanceof RegExp || el instanceof Date || el instanceof String || el instanceof Number || el instanceof Boolean);
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
      (o as { prototype: { constructor: unknown } }).prototype.constructor !== Object.getPrototypeOf(Function) &&
      o !== Function;
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
}