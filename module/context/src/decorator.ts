import type { AsyncMethodDescriptor } from '@travetto/runtime';

import type { AsyncContext } from './service.ts';

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
    const handle = descriptor.value!;
    descriptor.value = function (...args: unknown[]): ReturnType<typeof handle> {
      return this.context.run(handle.bind(this, ...args));
    };

    Object.defineProperty(descriptor.value, 'name', { value: handle.name });

    return descriptor;
  };
}