import { AppError, castTo } from '@travetto/runtime';
import { AsyncLocalStorage } from 'node:async_hooks';

type Payload<T> = Record<string | symbol, T | undefined>;
type Storage<T = unknown> = AsyncLocalStorage<Payload<T>>;
type Key = string | symbol;
type StorageSource = Storage | (() => Storage) | { storage: Storage } | { context: { storage: Storage } };

type ContextConfig = {
  failIfUnbound?: boolean;
};

/**
 * Async Context Value
 */
export class AsyncContextValue<T = unknown> {

  #source: () => Storage<T>;
  #storage?: Storage<T>;
  #key: Key = Symbol();
  #failIfUnbound: boolean;

  constructor(source: StorageSource, config?: ContextConfig) {
    this.#source = castTo(typeof source === 'function' ?
      source :
      ((): Storage => 'getStore' in source ?
        source :
        ('storage' in source ?
          source.storage :
          source.context.storage
        ))
    );
    this.#failIfUnbound = config?.failIfUnbound ?? true;
  }

  get #store(): Payload<T> | undefined {
    const store = (this.#storage ??= this.#source()).getStore();
    if (!store && this.#failIfUnbound) {
      console.trace('woo');
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