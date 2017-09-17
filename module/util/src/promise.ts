export function toPromise<T>(fn: (...args: any[]) => (T | Promise<T>)): (...args: any[]) => Promise<T> {
  if (fn.constructor.name !== 'GeneratorFunction') { // If std function
    return (...args: any[]) => new Promise<T>((resolve, reject) => {
      try {
        resolve(fn.apply(null, args));
      } catch (e) {
        reject(e);
      }
    })
  } else {
    return fn as (...args: any[]) => Promise<T>;
  }
}