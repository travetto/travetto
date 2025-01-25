import { AppError } from '@travetto/runtime';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Async Context Property
 */
export class AsyncContextProp<T, K extends string | symbol = string | symbol> {

  storage: AsyncLocalStorage<Record<K, T | undefined>>;
  key: K;
  failIfUnbound: boolean;

  constructor(
    storage: AsyncLocalStorage<Record<K, T | undefined>>,
    key: K,
    failIfUnbound = true
  ) {
    this.storage = storage;
    this.key = key;
    this.failIfUnbound = failIfUnbound;
  }

  get #store(): Record<K, T | undefined> | undefined {
    const store = this.storage.getStore();
    if (!store && this.failIfUnbound) {
      throw new AppError('Context not initialized');
    }
    return store;
  }

  get(): T | undefined {
    return this.#store?.[this.key];
  }

  set(value: T | undefined): void {
    const store = this.#store;
    if (store) {
      store[this.key] = value;
    }
  }
}