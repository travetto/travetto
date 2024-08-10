import { AsyncMethodDescriptor } from '@travetto/runtime';
import { AsyncContext } from './service';

/**
 * Allows running a function while providing an async context
 */
export function WithAsyncContext(data?: Record<string, unknown>) {
  return function <T extends { context: AsyncContext }>(
    target: T,
    prop: string,
    descriptor: AsyncMethodDescriptor<T>
  ): typeof descriptor {
    const og = descriptor.value!;
    descriptor.value = function (...args: unknown[]): ReturnType<typeof og> {
      return this.context.run(og.bind(this, ...args), structuredClone(data ?? {}));
    };

    Object.defineProperty(descriptor.value, 'name', { value: og.name });

    return descriptor;
  };
}