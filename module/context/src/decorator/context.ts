import { Context } from '../service';

export function WithContext<T extends { context: Context }>(data?: any) {
  return function (target: T, prop: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
    const og = descriptor.value!;
    descriptor.value = function (...args: any[]) {
      const self = this as T;
      return new Promise((resolve, reject) => {
        self.context.namespace.run(() => {
          try {
            if (data) {
              self.context.set(JSON.parse(JSON.stringify(data))); // Clone data
            }
            resolve(og.apply(self, args));
          } catch (e) {
            reject(e);
          }
        })
      });
    }

    Object.defineProperty(descriptor.value, 'name', { value: (og as any).name });

    return descriptor;
  }
}