import * as asyncHooks from 'async_hooks';

import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/base';

const { AsyncLocalStorage } = asyncHooks;

type Ctx = Record<string | symbol, unknown>;

/**
 * Async context using `asyncHooks`
 */
@Injectable()
export class AsyncContext {

  alStorage = new AsyncLocalStorage<{ value: Ctx }>();
  active = 0;

  constructor() {
    this.run = this.run.bind(this);
    this.iterate = this.iterate.bind(this);
  }

  #store(setAs?: Ctx | null): Ctx {
    const val = this.alStorage.getStore();
    if (!val) {
      throw new AppError('Context is not initialized', 'general');
    }
    if (setAs) {
      val.value = setAs;
    } else {
      if (!val.value) {
        val.value = {};
      }
    }
    return val.value;
  }

  /**
   * Get entire context or a portion by key
   */
  get<T = unknown>(key: string | symbol): T;
  get(): Ctx;
  get<T>(key?: string | symbol): Ctx | T {
    const root = this.#store();
    if (key) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return root[key as string] as T;
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
  async run<T = unknown>(fn: () => Promise<T>, init: Ctx = {}): Promise<T> {
    if (this.alStorage.getStore()) {
      init = { ...this.#store(), ...init };
    }
    this.active += 1;
    this.alStorage.enterWith({ value: init });
    try {
      return await fn();
    } finally {
      // @ts-expect-error
      delete this.alStorage.getStore().value;
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
      // @ts-expect-error
      delete this.alStorage.getStore().value;
      if ((this.active -= 1) === 0) {
        this.alStorage.disable();
      }
    }
  }
}