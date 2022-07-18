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

  constructor() {
    this.run = this.run.bind(this);
    this.iterate = this.iterate.bind(this);
  }

  #store(setAs?: Ctx | null) {
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
  get(): Record<string | symbol, unknown>;
  get<T>(key?: string | symbol) {
    const root = this.#store();
    if (key) {
      return root[key as string];
    } else {
      return root as T;
    }
  }

  /**
   * Set entire context or a portion by key
   */
  set(key: string | symbol, val: unknown): void;
  set(val: Ctx): void;
  set(keyOrVal: string | symbol | Ctx, valWithKey?: unknown) {
    if (typeof keyOrVal === 'string' || typeof keyOrVal === 'symbol') {
      this.get()[keyOrVal as string] = valWithKey;
    } else {
      this.#store(keyOrVal as Ctx);
    }
  }

  #context(ctx: Ctx = {}): { value: Ctx } {
    return { value: this.alStorage.getStore() ? { ...this.#store(), ...ctx } : ctx };
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async run<T = unknown>(fn: () => Promise<T>, init: Ctx = {}): Promise<T> {
    return await this.alStorage.run(this.#context(init), fn);
  }

  /**
   * Run an async function and ensure the context is available during execution
   */
  async * iterate<T>(fn: () => AsyncGenerator<T>, init: Ctx = {}): AsyncGenerator<T> {
    return yield* this.alStorage.run(this.#context(init), fn);
  }
}