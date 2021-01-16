import { AsyncContext } from './service';

/**
 * Allows running a function while providing an async context
 */
export function WithAsyncContext<T extends { context: AsyncContext }>(data?: Record<string, unknown>) {
  return function <U extends unknown[], V = unknown>(target: T, prop: string, descriptor: TypedPropertyDescriptor<(...args: U) => Promise<V>>) {
    const og = descriptor.value!;
    descriptor.value = function (this: T, ...args: unknown[]) {
      return (this.context.run((og as Function).bind(this, ...args),
        data ? JSON.parse(JSON.stringify(data)) : {})) as Promise<V>;
    };

    Object.defineProperty(descriptor.value, 'name', { value: og.name });

    return descriptor;
  };
}