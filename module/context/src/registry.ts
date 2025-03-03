import { AppError, castTo, Class } from '@travetto/runtime';

import { AsyncContextValue } from './value';

class $AsyncContextValueRegistry {
  #providers = new Map<Class, { value: AsyncContextValue | (() => AsyncContextValue), transform?: Function }>();

  /**
   * Register a new Async context value by type
   * @param type The type to register against
   * @param transform Transform the value
   * @private
   */
  register<T, U>(type: Class<T>, value: AsyncContextValue<U> | (() => AsyncContextValue<U>), transform: (v: U) => T): void;
  register<T>(type: Class<T>, value: AsyncContextValue<T> | (() => AsyncContextValue<T>)): void;
  register<T>(type: Class<T>, value: AsyncContextValue<T> | (() => AsyncContextValue<T>), transform?: Function): void {
    this.#providers.set(type, { value, transform });
  }

  /**
   * Get the contextual value
   */
  get<T>(type: Class<T>): T | undefined {
    if (!this.#providers.has(type)) {
      throw new AppError(`Unknown provider type: ${type.name}`);
    }
    const { value, transform } = this.#providers.get(type)!;
    const acv: AsyncContextValue<T> = castTo(typeof value === 'function' ? value() : value);
    const res = acv.get();
    if (res) {
      if (transform) {
        return transform(res);
      }
      return res;
    }
  }
}

export const AsyncContextValueRegistry = new $AsyncContextValueRegistry();