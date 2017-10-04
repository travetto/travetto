import { Context } from '../service';

export function WithContext<T extends { context: Context }>(data: any) {
  return function (target: T, prop: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
    let og = descriptor.value;
    descriptor.value = function (...args: any[]) {
      return new Promise((resolve, reject) => {
        target.context.namespace.run(() => {
          try {
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