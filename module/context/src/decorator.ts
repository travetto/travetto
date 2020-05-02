import { AsyncContext } from './service';

/**
 * Allows running a function while providing an async context
 */
export function WithAsyncContext<T extends { context: AsyncContext }>(data?: any) {
  return function (target: T, prop: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
    const og = descriptor.value!;
    descriptor.value = function (this: T, ...args: any[]) {
      return this.context.run(og.bind(this, ...args),
        data ? JSON.parse(JSON.stringify(data)) : {});
    };

    Object.defineProperty(descriptor.value, 'name', { value: (og as any).name });

    return descriptor;
  };
}