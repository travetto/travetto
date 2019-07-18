import * as crypto from 'crypto';

function find<T>(set: Set<T>, pred: (x: T) => boolean): T | undefined {
  for (const i of set) {
    if (pred(i)) {
      return i;
    }
  }
  return undefined;
}

function toList<T>(items: T | T[] | Set<T> | undefined) {
  if (!items) {
    return [];
  }
  if (Array.isArray(items)) {
    return items;
  }
  if (items instanceof Set) {
    return Array.from(items);
  }
  return [items];
}

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

  static coerceType(input: any, type: typeof String, strict?: boolean): string;
  static coerceType(input: any, type: typeof Number, strict?: boolean): number;
  static coerceType(input: any, type: typeof Boolean, strict?: boolean): boolean;
  static coerceType(input: any, type: typeof Date, strict?: boolean): Date;
  static coerceType<T>(input: any, type: { new(...args: any[]): T }, strict?: boolean): T;
  static coerceType(input: any, type: any, strict = true) {
    if (type && input instanceof type) {
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
        const res = /^(true|yes|1|on)$/.test(input);
        if (strict && !/^(false|no|off|0|true|yes|on|1)$/i.test(input)) {
          throw new Error(`Invalid boolean value: ${input}`);
        }
        return res;
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
    return proto && proto === Function.prototype || proto.constructor.name === 'AsyncFunction';
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

  static throttle<T, U, V>(fn: (a: T, b: U) => V, threshold?: number): (a: T, b: U) => V;
  static throttle<T extends Function>(fn: T, threshold = 250) {
    let last = 0;
    let deferTimer: NodeJS.Timer;
    return function (...args: any[]) {
      const now = Date.now();
      if (last && now < last + threshold) {
        // hold on to it
        clearTimeout(deferTimer);
        deferTimer = setTimeout(function () {
          last = now;
          fn.apply(null, args);
        }, threshold);
      } else {
        last = now;
        fn.apply(null, args);
      }
    } as any as T;
  }

  static naiveHash(text: string) {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // tslint:disable-next-line: no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  static uuid(len: number = 32) {
    return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').substring(0, len);
  }

  static computeOrdering<T,
    U extends {
      after?: T | Set<T> | T[],
      before?: T | Set<T> | T[],
      key: T
    },
    V extends {
      after: Set<T>;
      key: T;
      target: U
    }
  >(items: U[]) {

    // Turn items into a map by .key value, pointing to a mapping of type V
    const allMap = new Map(items.map(x => [
      x.key, {
        key: x.key,
        target: x,
        after: new Set(toList(x.after))
      }
    ] as [T, V]));

    const all = new Set<V>(allMap.values());

    // Loop through all new items of type V, converting before into after
    for (const item of all) {
      const before = toList(item.target.before);
      for (const bf of before) {
        if (allMap.has(bf)) {
          allMap.get(bf)!.after.add(item.key);
        }
      }
      item.after = new Set(Array.from(item.after).filter(x => allMap.has(x)));
    }

    // Loop through all items again
    const out: U[] = [];
    while (all.size > 0) {

      // Find node with no dependencies
      const next = find(all, x => x.after.size === 0);
      if (!next) {
        throw new Error(`Unsatisfiable dependency: ${Array.from(all).map(x => x.target)}`);
      }

      // Store, and remove
      out.push(next.target);
      all.delete(next);

      // Remove node from all other elements in `all`
      for (const rem of all) {
        rem.after.delete(next.key);
      }
    }

    return out;
  }
}