export function isPrimitive(el: any): el is (string | boolean | number | RegExp) {
  const type = typeof el;
  return el !== null && el !== undefined && (type === 'string' || type === 'boolean' || type === 'number' || el instanceof RegExp);
}

export function isPlainObject(obj: any): obj is { [key: string]: any } {
  return typeof obj === 'object' // separate from primitives
    && obj !== undefined
    && obj !== null         // is obvious
    && obj.constructor === Object // separate instances (Array, DOM, ...)
    && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
}

export function isFunction(o: any): o is Function {
  return o && Object.getPrototypeOf(o) === Function.prototype;
}

export function isClass(o: any) {
  return o && o.prototype && o.prototype.constructor !== Object.getPrototypeOf(Function);
}

export function isSimple(a: any) {
  return isPrimitive(a) || isFunction(a) || isClass(a);
}

function _deepMerge(a: any, b: any, mode: 'loose' | 'strict' | 'coerce' = 'loose') {
  const isEmptyA = a === undefined || a === null;
  const isEmptyB = b === undefined || b === null;
  const isArrA = Array.isArray(a);
  const isArrB = Array.isArray(b);

  if (isArrB) { // Arrays
    const bArr = b;
    if (a && !isArrA) {
      throw new Error(`Cannot merge non-array ${a} with array ${b}`);
    } else if (!a) {
      return bArr.slice(0);
    } else {
      const aArr = (a as any as any[]).slice(0);
      for (let i = 0; i < bArr.length; i++) {
        aArr[i] = _deepMerge(aArr[i], bArr[i], mode);
      }
      a = aArr;
    }
  } else if (b === null || isSimple(b)) { // Scalars
    if (!isEmptyA) {
      if (!isSimple(a)) {
        throw new Error(`Cannot merge primitive ${b} with ${a}`);
      } else {
        const match = typeof a === typeof b;
        if (!match) {
          if (mode === 'strict') {
            throw new Error(`Cannot merge ${a} [${typeof a}] with ${b} [${typeof b}]`);
          } else if (mode === 'coerce') {
            switch (typeof a) {
              case 'string': b = `${b}`; break;
              case 'number': b = `${b}`.indexOf('.') >= 0 ? parseFloat(`${b}`) : parseInt(`${b}`, 10); break;
              case 'boolean': b = !!b; break;
            }
          }
        }
      }
    }
    a = b;
  } else if (!isEmptyB) { // Object merge
    if (isEmptyA) {
      a = {};
    }

    for (const key of Object.keys(b)) {
      a[key] = _deepMerge(a[key], b[key], mode);
    }
  }

  return a;
}

export function deepMerge<T extends any, U extends any>(a: T, b: U, mode: 'loose' | 'strict' | 'coerce' = 'loose'): T & U {
  if (!a || isPrimitive(a)) {
    throw new Error(`Cannot merge onto a primitive value, ${a}`);
  }
  return _deepMerge(a, b, mode) as T & U;
}

export function throttle(fn: (...args: any[]) => any, threshhold = 250) {
  let last = 0;
  let deferTimer: NodeJS.Timer;
  return function (...args: any[]) {
    const now = Date.now();
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function () {
        last = now;
        fn.apply(null, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(null, args);
    }
  };
}