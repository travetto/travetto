export function nodeToPromise<T>(ctx: any | null, fn: Function, ...args: any[]): Promise<T> {
  let handler = (resolve: (args?: T) => void, reject: (err?: any) => void): void => {
    args.push((err: any, res: T) => {
      if (err !== undefined && err !== null) {
        reject(err);
      } else {
        resolve(res);
      }
    });
    try {
      fn.apply(ctx, args);
    } catch (e) {
      reject(e);
    }
  };
  return new Promise<T>(handler);
}


export function toPromise<T>(fn: (...args: any[]) => (T | Promise<T>)): (...args: any[]) => Promise<T> {
  if ((fn.constructor as any).name !== 'GeneratorFunction') { // If std function
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

export function promiseToNode<T, U>(ctx: Object | null, fn: (o: T, ...args: any[]) => Promise<U>): (arg: T, ...args: any[]) => Promise<U> {
  return (arg: T, ...args: any[]) => {
    let done: (err: any, res?: any) => void = args.pop();
    return fn.apply(ctx, [arg, ...args])
      .then((v: any) => { done(null, v); return v; })
      .catch((err: any) => done(err));
  }
}

export function externalPromise() {
  let p: Promise<any> & { resolve?: Function, reject?: Function } = new Promise((resolve, reject) => {
    p.resolve = resolve;
    p.reject = reject;
  });
  return p as (Promise<any> & { resolve: Function, reject: Function });
}