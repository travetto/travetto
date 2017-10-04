import { Context } from '../service';

export function WithContext<T extends { context: Context }>(data?: any) {
  return function (target: T, prop: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
    let og = descriptor.value;
    descriptor.value = function (...args: any[]) {
      return new Promise((resolve, reject) => {
        target.context.namespace.run(() => {
          try {
            if (data) {
              target.context.set(JSON.parse(JSON.stringify(data))); // Clone data
            }
            resolve(og.apply(this, args));
          } catch (e) {
            reject(e);
          }
        })
      });
    }
    return descriptor;
  }
}