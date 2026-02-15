import type { AsyncLocalStorage } from 'node:async_hooks';

import { RuntimeError, castTo } from '@travetto/runtime';

type Payload<T> = Record<string | symbol, T | undefined>;
type Storage<T = unknown> = AsyncLocalStorage<Payload<T>>;
type Key = string | symbol;
type StorageSource = Storage | (() => Storage) | { storage: Storage } | { context: { storage: Storage } };

type ReadWriteConfig = { read?: boolean, write?: boolean };
type ContextConfig = { failIfUnbound?: ReadWriteConfig };

/**
 * Async Context Value
 */
export class AsyncContextValue<T = unknown> {

  #source: () => Storage<T>;
  #storage?: Storage<T>;
  #key: Key = Symbol();
  #failIfUnbound: ReadWriteConfig;

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
    this.#failIfUnbound = { read: true, write: true, ...config?.failIfUnbound };
  }

  #store(mode: keyof ReadWriteConfig): Payload<T> | undefined {
    const store = (this.#storage ??= this.#source()).getStore();
    if (!store && this.#failIfUnbound[mode]) {
      throw new RuntimeError('Context not initialized');
    }
    return store;
  }

  /**
   * Get value
   */
  get(): T | undefined {
    const store = this.#store('read');
    if (store) {
      return store[this.#key];
    }
  }

  /**
   * Set value
   */
  set(value: T | undefined): void {
    const store = this.#store('write');
    if (store) {
      store[this.#key] = value;
    }
  }
}
