import { AppError, castTo } from '@travetto/runtime';
import { AsyncLocalStorage } from 'node:async_hooks';

type Payload<T> = Record<string | symbol, T | undefined>;
type Store<T = unknown> = AsyncLocalStorage<Payload<T>>;
type Key = string | symbol;

/**
 * Async Context Value
 */
export class AsyncContextValue<T = unknown> {

  #storeFn: () => Store;
  #storage?: Store<T>;
  #key: Key;
  #failIfUnbound: boolean;

  constructor(
    store: (() => Store) | { storage: Store } | { context: { storage: Store } },
    cfg?: Key | { key?: Key, failIfUnbound?: boolean }
  ) {
    if (typeof cfg === 'string' || typeof cfg === 'symbol') {
      cfg = { key: cfg };
    }
    this.#storeFn = typeof store === 'function' ? store : ((): Store => 'storage' in store ? store.storage : store.context.storage);
    this.#key = cfg?.key ?? Symbol();
    this.#failIfUnbound = cfg?.failIfUnbound ?? true;
  }

  get #store(): Payload<T> | undefined {
    const store = (this.#storage ??= castTo(this.#storeFn())).getStore();
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