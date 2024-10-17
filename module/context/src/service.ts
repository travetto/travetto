import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@travetto/di';
import { AppError, castTo } from '@travetto/runtime';


type Ctx<T = unknown> = Record<string | symbol, T>;

/**
 * Async context using `asyncHooks`
 */
@Injectable()
export class AsyncContext {

  alStorage = new AsyncLocalStorage<{ value?: Ctx }>();
  active = 0;

  constructor() {
    this.run = this.run.bind(this);
    this.iterate = this.iterate.bind(this);
  }

  #store<T = unknown>(setAs?: Ctx<T> | null): Ctx<T> {
    const val = this.alStorage.getStore();
    if (!val) {
      throw new AppError('Context is not initialized');
    }
    if (setAs) {
      val.value = setAs;
    } else if (!val.value) {
      val.value = {};
    }
    return castTo(val.value);
  }

  /**
   * Get entire context or a portion by key
   */
  get<T = unknown>(key: string | symbol): T;
  get(): Ctx;
  get<T>(key?: string | symbol): Ctx | T {
    const root = this.#store<T>();
    if (key) {
      return root[key];
    } else {
      return root;
    }
  }

  /**
   * Set entire context or a portion by key
   */
  set(key: string | symbol, val: unknown): void;
  set(val: Ctx): void;
  set(keyOrVal: string | symbol | Ctx, valWithKey?: unknown): void {
    if (typeof keyOrVal === 'string' || typeof keyOrVal === 'symbol') {
      this.get()[keyOrVal] = valWithKey;
    } else {
      this.#store(keyOrVal);
    }
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async run<T = unknown>(fn: () => Promise<T> | T, init: Ctx = {}): Promise<T> {
    if (this.alStorage.getStore()) {
      init = { ...this.#store(), ...init };
    }
    this.active += 1;
    this.alStorage.enterWith({ value: init });
    try {
      return await fn();
    } finally {
      delete this.alStorage.getStore()?.value;
      if ((this.active -= 1) === 0) {
        this.alStorage.disable();
      }
    }
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async * iterate<T>(fn: () => AsyncGenerator<T>, init: Ctx = {}): AsyncGenerator<T> {
    if (this.alStorage.getStore()) {
      init = { ...this.#store(), ...init };
    }
    this.active += 1;
    this.alStorage.enterWith({ value: init });
    try {
      return yield* fn();
    } finally {
      delete this.alStorage.getStore()?.value;
      if ((this.active -= 1) === 0) {
        this.alStorage.disable();
      }
    }
  }
}