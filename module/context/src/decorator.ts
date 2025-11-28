import { AsyncMethodDescriptor } from '@travetto/runtime';

import { AsyncContext } from './service.ts';

/**
 * Allows running a function while providing an async context
 * @kind decorator
 */
export function WithAsyncContext() {
  return function <T extends { context: AsyncContext }>(
    target: T,
    property: string,
    descriptor: AsyncMethodDescriptor<T>
  ): typeof descriptor {
    const og = descriptor.value!;
    descriptor.value = function (...args: unknown[]): ReturnType<typeof og> {
      return this.context.run(og.bind(this, ...args));
    };

    Object.defineProperty(descriptor.value, 'name', { value: og.name });

    return descriptor;
  };
}