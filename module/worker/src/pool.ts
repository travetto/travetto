import os from 'node:os';
import gp from 'generic-pool';
import timers from 'node:timers/promises';

import { Env, ShutdownManager } from '@travetto/base';

import { WorkSet } from './input/types';
import { ManualAsyncIterator } from '../src/input/async-iterator';

/**
 * Worker definition
 */
export interface Worker<X, T = unknown> {
  active: boolean;
  id: unknown;
  init?(): Promise<unknown>;
  execute(input: X): Promise<T>;
  destroy(): Promise<void>;
  release?(): unknown;
}

type WorkPoolProcessConfig<X, T> = {
  shutdownOnComplete?: boolean;
  onComplete?: <T>(ev: WorkCompletionEvent<X, T>) => (void | Promise<void>);
};

type WorkCompletionEvent<X, T> = { idx: number, total?: number, input: X, result?: T };

/**
 * Work pool support
 */
export class WorkPool<X, T = unknown> {

  static MAX_SIZE = os.cpus().length - 1;
  static DEFAULT_SIZE = Math.min(WorkPool.MAX_SIZE, 4);

  /**
   * Generic-pool pool
   */
  #pool: gp.Pool<Worker<X, T>>;
  /**
   * Number of acquisitions in process
   */
  #pendingAcquires = 0;
  /**
   * List of errors during processing
   */
  #errors: Error[] = [];

  /**
   * Error count during creation
   */
  #createErrors = 0;

  /**
   * Are we tracing
   */
  #trace: boolean;

  /**
   * Cleanup for shutdown
   */
  #shutdownCleanup?: () => void;

  /**
   *
   * @param getWorker Produces a new worker for the pool
   * @param opts Pool options
   */
  constructor(getWorker: () => Promise<Worker<X, T>> | Worker<X, T>, opts?: gp.Options) {
    const args = {
      max: WorkPool.DEFAULT_SIZE,
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts ?? {}),
    };

    // Create the pool
    this.#pool = gp.createPool({
      create: () => this.#createAndTrack(getWorker, args),
      destroy: x => this.destroy(x),
      validate: async (x: Worker<X, T>) => x.active
    }, args);

    this.#shutdownCleanup = ShutdownManager.onGracefulShutdown(async () => {
      this.#shutdownCleanup = undefined;
      this.shutdown();
    }, `worker.pool.${this.constructor.name}`);

    this.#trace = /@travetto\/worker/.test(Env.DEBUG.val ?? '');
  }

  /**
   * Creates and tracks new worker
   */
  async #createAndTrack(getWorker: () => Promise<Worker<X, T>> | Worker<X, T>, opts: gp.Options): Promise<Worker<X, T>> {
    try {
      this.#pendingAcquires += 1;
      const res = await getWorker();

      if (res.init) {
        await res.init();
      }

      this.#createErrors = 0; // Reset errors on success

      return res;
    } catch (err) {
      if (this.#createErrors++ > opts.max!) { // If error count is bigger than pool size, we broke
        console.error('Failed in creating pool', { error: err });
        await ShutdownManager.gracefulShutdown(1);
      }
      throw err;
    } finally {
      this.#pendingAcquires -= 1;
    }
  }

  /**
   * Destroy the worker
   */
  async destroy(worker: Worker<X, T>): Promise<void> {
    if (this.#trace) {
      console.debug('Destroying', { pid: process.pid, worker: worker.id });
    }
    return worker.destroy();
  }

  /**
   * Free worker on completion
   */
  async release(worker: Worker<X, T>): Promise<void> {
    if (this.#trace) {
      console.debug('Releasing', { pid: process.pid, worker: worker.id });
    }
    try {
      if (worker.active) {
        try {
          await worker.release?.();
        } catch { }
        await this.#pool.release(worker);
      } else {
        await this.#pool.destroy(worker);
      }
    } catch { }
  }

  /**
   * Process a given input source
   */
  async process(src: WorkSet<X>, cfg: WorkPoolProcessConfig<X, T> = {}): Promise<void> {
    const pending = new Set<Promise<unknown>>();
    let count = 0;

    if (src.size && cfg.onComplete) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      cfg.onComplete({ input: undefined as X, idx: 0, total: src.size });
    }

    while (await src.hasNext()) {
      const worker = (await this.#pool.acquire())!;
      if (this.#trace) {
        console.debug('Acquired', { pid: process.pid, worker: worker.id });
      }
      const nextInput = await src.next();

      const completion = worker.execute(nextInput)
        .catch(err => this.#errors.push(err)) // Catch error
        .finally(() => this.release(worker))
        .then(
          v => cfg.onComplete?.({ input: nextInput, idx: count += 1, total: src.size, result: v as T }),
          () => cfg.onComplete?.({ input: nextInput, idx: count += 1, total: src.size })
        );

      completion.finally(() => pending.delete(completion));

      pending.add(completion);
    }

    try {
      await Promise.all(Array.from(pending));

      if (this.#errors.length) {
        throw this.#errors[0];
      }
    } finally {
      if (cfg.shutdownOnComplete !== false) {
        await this.shutdown();
      }
    }
  }

  /**
   * Process a given input source as an async iterable, emitting on completion
   */
  iterateProcess(src: WorkSet<X>, shutdownOnComplete?: boolean): AsyncIterable<WorkCompletionEvent<X, T>> {
    const itr = new ManualAsyncIterator<WorkCompletionEvent<X, T>>();
    const res = this.process(src, { onComplete: ev => itr.add(ev as unknown as WorkCompletionEvent<X, T>), shutdownOnComplete });
    res.finally(() => itr.close());
    return itr;
  }

  /**
   * Shutdown pool
   */
  async shutdown(): Promise<void> {
    this.#shutdownCleanup?.();

    while (this.#pendingAcquires) {
      await timers.setTimeout(10);
    }
    await this.#pool.drain();
    await this.#pool.clear();
  }
}
