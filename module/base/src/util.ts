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

  private static _deepAssign(a: any, b: any, mode: 'loose' | 'strict' | 'coerce' = 'loose') {
    const isEmptyA = a === undefined || a === null;
    const isEmptyB = b === undefined || b === null;
    const isArrA = Array.isArray(a);
    const isArrB = Array.isArray(b);
    const isSimpA = !isEmptyA && Util.isSimple(a);
    const isSimpB = !isEmptyB && Util.isSimple(b);

    let ret: any;

    if (isEmptyA || isEmptyB) { // If no `a`, `b` always wins
      if (b === null || !isEmptyB) {
        ret = isEmptyB ? b : Util.shallowClone(b);
      } else if (!isEmptyA) {
        ret = Util.shallowClone(a);
      } else {
        ret = undefined;
      }
    } else {
      if (isArrA !== isArrB || isSimpA !== isSimpB) {
        throw new Error(`Cannot merge differing types ${a} and ${b}`);
      }
      if (isArrB) { // Arrays
        ret = a; // Write onto A
        for (let i = 0; i < b.length; i++) {
          ret[i] = Util._deepAssign(ret[i], b[i], mode);
        }
      } else if (isSimpB) { // Scalars
        const match = typeof a === typeof b;
        ret = b;

        if (!match) { // If types do not match
          if (mode === 'strict') { // Bail on strict
            throw new Error(`Cannot merge ${a} [${typeof a}] with ${b} [${typeof b}]`);
          } else if (mode === 'coerce') { // Force on coerce
            switch (typeof a) {
              case 'string': ret = `${b}`; break;
              case 'number': ret = `${b}`.indexOf('.') >= 0 ? parseFloat(`${b}`) : parseInt(`${b}`, 10); break;
              case 'boolean': ret = !!b; break;
              default:
                throw new Error(`Unknown type ${typeof a}`);
            }
          }
        }
      } else { // Object merge
        ret = a;

        for (const key of Object.keys(b)) {
          ret[key] = Util._deepAssign(ret[key], b[key], mode);
        }
      }
    }
    return ret;
  }

  static shallowClone(a: any) {
    return Array.isArray(a) ? a.slice(0) : (Util.isSimple(a) ? a : { ...a });
  }

  static isPrimitive(el: any): el is (string | boolean | number | RegExp) {
    const type = typeof el;
    return el !== null && el !== undefined && (type === 'string' || type === 'boolean' || type === 'number' || el instanceof RegExp);
  }

  static isPlainObject(obj: any): obj is { [key: string]: any } {
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
    return Util.isPrimitive(a) || Util.isFunction(a) || Util.isClass(a);
  }

  static deepAssign<T extends any, U extends any>(a: T, b: U, mode: 'loose' | 'strict' | 'coerce' = 'loose'): T & U {
    if (!a || Util.isSimple(a)) {
      throw new Error(`Cannot merge onto a simple value, ${a}`);
    }
    return Util._deepAssign(a, b, mode) as T & U;
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
        allMap.get(bf)!.after.add(item.key);
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