import { AppError, castTo } from '@travetto/runtime';
import { AsyncLocalStorage } from 'node:async_hooks';

type Payload<T> = Record<string | symbol, T | undefined>;
type Storage<T = unknown> = AsyncLocalStorage<Payload<T>>;
type Key = string | symbol;

/**
 * Async Context Value
 */
export class AsyncContextValue<T = unknown> {

  #source: () => Storage<T>;
  #storage?: Storage<T>;
  #key: Key;
  #failIfUnbound: boolean;

  constructor(
    source: Storage | (() => Storage) | { storage: Storage } | { context: { storage: Storage } },
    config?: Key | { key?: Key, failIfUnbound?: boolean }
  ) {
    if (typeof config === 'string' || typeof config === 'symbol') {
      config = { key: config };
    }
    this.#source = castTo(typeof source === 'function' ?
      source :
      ((): Storage => 'getStore' in source ?
        source :
        ('storage' in source ?
          source.storage :
          source.context.storage
        ))
    );
    this.#key = config?.key ?? Symbol();
    this.#failIfUnbound = config?.failIfUnbound ?? true;
  }

  get #store(): Payload<T> | undefined {
    const store = (this.#storage ??= this.#source()).getStore();
    if (!store && this.#failIfUnbound) {
      throw new AppError('Context not initialized');
    }
    return store;
  }

  /**
   * Get value
   */
  get(): T | undefined {
    return this.#store?.[this.#key];
  }

  /**
   * Set value
   */
  set(value: T | undefined): void {
    const store = this.#store;
    if (store) {
      store[this.#key] = value;
    }
  }
}