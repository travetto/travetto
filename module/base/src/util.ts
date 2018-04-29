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

function shallowClone(a: any) {
  return Array.isArray(a) ? a.slice(0) : (isSimple(a) ? a : { ...a });
}

function _deepAssign(a: any, b: any, mode: 'loose' | 'strict' | 'coerce' = 'loose') {
  const isEmptyA = a === undefined || a === null;
  const isEmptyB = b === undefined || b === null;
  const isArrA = Array.isArray(a);
  const isArrB = Array.isArray(b);
  const isSimpA = !isEmptyA && isSimple(a);
  const isSimpB = !isEmptyB && isSimple(b);

  let ret: any;

  if (isEmptyA || isEmptyB) { // If no `a`, `b` always wins
    ret = b === null ? b : shallowClone(b || a);
  } else {
    if (isArrA !== isArrB || isSimpA !== isSimpB) {
      throw new Error(`Cannot merge differing types ${a} and ${b}`);
    }
    if (isArrB) { // Arrays
      ret = a; // Write onto A
      for (let i = 0; i < b.length; i++) {
        ret[i] = _deepAssign(ret[i], b[i], mode);
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
        ret[key] = _deepAssign(ret[key], b[key], mode);
      }
    }
  }
  return ret;
}

export function deepAssign<T extends any, U extends any>(a: T, b: U, mode: 'loose' | 'strict' | 'coerce' = 'loose'): T & U {
  if (!a || isSimple(a)) {
    throw new Error(`Cannot merge onto a simple value, ${a}`);
  }
  return _deepAssign(a, b, mode) as T & U;
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