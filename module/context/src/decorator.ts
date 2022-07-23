import { AsyncContext } from './service';

/**
 * Allows running a function while providing an async context
 */
export function WithAsyncContext<T extends { context: AsyncContext }>(data?: Record<string, unknown>) {
  return function <U extends unknown[], V = unknown>(
    target: T,
    prop: string,
    descriptor: TypedPropertyDescriptor<(...args: U) => Promise<V>>
  ): typeof descriptor {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const og = descriptor.value! as (this: T, ...args: unknown[]) => Promise<V>;
    descriptor.value = function (this: T, ...args: unknown[]): Promise<V> {
      return (this.context.run(og.bind(this, ...args),
        data ? JSON.parse(JSON.stringify(data)) : {}));
    };

    Object.defineProperty(descriptor.value, 'name', { value: og.name });

    return descriptor;
  };
}