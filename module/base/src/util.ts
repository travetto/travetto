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

export function deepMerge<T extends any, U extends any>(a: T, b: U): T & U {
  const isEmptyA = a === undefined || a === null;
  const isEmptyB = b === undefined || b === null;
  const isArrA = Array.isArray(a);
  const isArrB = Array.isArray(b);

  if (!isEmptyB) {
    if (isPrimitive(b)) {
      if (isEmptyA || isPrimitive(a)) {
        return b as any as (T & U);
      } else {
        throw new Error(`Cannot merge primitive ${b} with ${a}`);
      }
    } else if (isArrB) {
      const bArr = b as any as any[];
      if (a === undefined) {
        return bArr.slice(0) as any as T & U;
      } else if (isArrA) {
        const aArr = (a as any as any[]).slice(0);
        for (let i = 0; i < bArr.length; i++) {
          aArr[i] = deepMerge(aArr[i], bArr[i]);
        }
        return aArr as any as T & U;
      } else {
        throw new Error(`Cannot merge ${a} with ${b}`);
      }
    } else {
      if (isEmptyA || isArrA || isPrimitive(a)) {
        throw new Error(`Cannot merge ${b} onto ${a}`);
      }
      for (const key of Object.keys(b)) {
        a[key] = deepMerge(a[key], b[key]);
      }
      return a as (T & U);
    }
  }
  return a as (T & U);
}
