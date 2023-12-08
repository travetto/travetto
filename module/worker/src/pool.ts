import os from 'os';
import gp from 'generic-pool';
import timers from 'timers/promises';

import { Env, ShutdownManager } from '@travetto/base';

import { WorkSet } from './input/types';
import { ManualAsyncIterator } from '../src/input/async-iterator';

/**
 * Worker definition
 */
export interface Worker<X> {
  active: boolean;
  id: unknown;
  init?(): Promise<unknown>;
  execute(input: X): Promise<unknown>;
  destroy(): Promise<void>;
  release?(): unknown;
}

type WorkPoolProcessConfig<X> = {
  shutdownOnComplete?: boolean;
  onComplete?: (ev: WorkCompletionEvent<X>) => (void | Promise<void>);
};

type WorkCompletionEvent<X> = { idx: number, total?: number, value: X };

/**
 * Work pool support
 */
export class WorkPool<X> {

  static MAX_SIZE = os.cpus().length - 1;
  static DEFAULT_SIZE = Math.min(WorkPool.MAX_SIZE, 4);

  /**
   * Generic-pool pool
   */
  #pool: gp.Pool<Worker<X>>;
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
  constructor(getWorker: () => Promise<Worker<X>> | Worker<X>, opts?: gp.Options) {
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
      validate: async (x: Worker<X>) => x.active
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
  async #createAndTrack(getWorker: () => Promise<Worker<X>> | Worker<X>, opts: gp.Options): Promise<Worker<X>> {
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
  async destroy(worker: Worker<X>): Promise<void> {
    if (this.#trace) {
      console.debug('Destroying', { pid: process.pid, worker: worker.id });
    }
    return worker.destroy();
  }

  /**
   * Free worker on completion
   */
  async release(worker: Worker<X>): Promise<void> {
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
  async process(src: WorkSet<X>, cfg: WorkPoolProcessConfig<X> = {}): Promise<void> {
    const pending = new Set<Promise<unknown>>();
    let count = 0;

    if (src.size && cfg.onComplete) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      cfg.onComplete({ value: undefined as X, idx: 0, total: src.size });
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
        .finally(() => cfg.onComplete?.({ value: nextInput, idx: count += 1, total: src.size }));

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
  iterateProcess(src: WorkSet<X>, shutdownOnComplete?: boolean): AsyncIterable<WorkCompletionEvent<X>> {
    const itr = new ManualAsyncIterator<WorkCompletionEvent<X>>();
    const res = this.process(src, { onComplete: ev => itr.add(ev), shutdownOnComplete });
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
