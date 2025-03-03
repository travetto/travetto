import { AsyncMethodDescriptor, Class } from '@travetto/runtime';
import { AsyncContext } from './service';
import { AsyncContextValueRegistry } from './registry';

/**
 * Allows running a function while providing an async context
 */
export function WithAsyncContext() {
  return function <T extends { context: AsyncContext }>(
    target: T,
    prop: string,
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

/**
 * A contextual field as provided by the async context registry
 * @augments `@travetto/context:AsyncContextField`
 */
export function AsyncContextField(cfg?: { target?: Class }) {
  return (target: unknown, propertyKey: string | symbol): void => {
    Object.defineProperty(
      target, propertyKey,
      {
        get: (): unknown => AsyncContextValueRegistry.get(cfg?.target!),
        set: (v) => { }
      }
    );
  };
}
