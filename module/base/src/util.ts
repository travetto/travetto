export function isPrimitive(el: any): el is (string | boolean | number | RegExp) {
  const type = typeof el;
  return (type === 'string' || type === 'boolean' || type === 'number' || el instanceof RegExp);
}

export function isPlainObject(obj: any): obj is object {
  return typeof obj === 'object' // separate from primitives
    && obj !== null         // is obvious
    && obj.constructor === Object // separate instances (Array, DOM, ...)
    && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
}

export function isFunction(o: any): o is Function {
  return Object.getPrototypeOf(o) === Function.prototype;
}

function _deepMerge(a: any, b: any, level = 0) {
  const isEmptyA = a === undefined || a === null;
  const isEmptyB = b === undefined || b === null;
  const isArrA = Array.isArray(a);
  const isArrB = Array.isArray(b);

  if (!isEmptyB) {
    if (isPrimitive(b)) {
      if (isEmptyA || isPrimitive(a)) {
        return b;
      } else {
        throw new Error(`Cannot merge primitive ${b} with ${a}`);
      }
    } else if (isArrB) {
      const bArr = b;
      if (a === undefined) {
        return bArr.slice(0);
      } else if (isArrA) {
        const aArr = (a as any as any[]).slice(0);
        for (let i = 0; i < bArr.length; i++) {
          aArr[i] = _deepMerge(aArr[i], bArr[i], level + 1);
        }
        a = aArr;
      } else if (b !== undefined) {
        throw new Error(`Cannot merge ${b} with ${a}`);
      }
    } else {
      if (isEmptyA || isArrA || isPrimitive(a)) {
        if (level === 0) {
          throw new Error(`Cannot merge ${b} onto ${a}`);
        } else {
          a = {};
        }
      }
      for (const key of Object.keys(b)) {
        a[key] = _deepMerge(a[key], b[key], level + 1);
      }
    }
  }
  return a;
}

export function deepMerge<T extends any, U extends any>(a: T, b: U): T & U {
  return _deepMerge(a, b, 0) as T & U;
}