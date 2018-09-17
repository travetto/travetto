import { Context } from './service';

export function WithContext<T extends { context: Context }>(data?: any) {
  return function (target: T, prop: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
    const og = descriptor.value!;
    descriptor.value = function (this: T, ...args: any[]) {
      // tslint:disable-line no-invalid-this
      return this.context.run(og.bind(this, args),
        data ? JSON.parse(JSON.stringify(data)) : {});
    };

    Object.defineProperty(descriptor.value, 'name', { value: (og as any).name });

    return descriptor;
  };
}