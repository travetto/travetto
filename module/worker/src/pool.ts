import os from 'os';
import gp from 'generic-pool';

import { GlobalEnv, ShutdownManager, TimeUtil } from '@travetto/base';
import { TerminalProgressEvent } from '@travetto/terminal';

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

/**
 * Work pool support
 */
export class WorkPool<X, T extends Worker<X>> {

  static DEFAULT_SIZE = Math.min(os.cpus().length - 1, 4);

  /**
   * Generic-pool pool
   */
  #pool: gp.Pool<T>;
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
   *
   * @param getWorker Produces a new worker for the pool
   * @param opts Pool options
   */
  constructor(getWorker: () => Promise<T> | T, opts?: gp.Options) {
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
      validate: async (x: T) => x.active
    }, args);

    ShutdownManager.onShutdown(`worker.pool.${this.constructor.name}`, () => this.shutdown());

    this.#trace = !!GlobalEnv.debug?.includes('@travetto/worker');
  }

  /**
   * Creates and tracks new worker
   */
  async #createAndTrack(getWorker: () => Promise<T> | T, opts: gp.Options): Promise<T> {
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
        process.exit(1);
      }
      throw err;
    } finally {
      this.#pendingAcquires -= 1;
    }
  }

  /**
   * Destroy the worker
   */
  async destroy(worker: T): Promise<void> {
    if (this.#trace) {
      console.debug('Destroying', { pid: process.pid, worker: worker.id });
    }
    return worker.destroy();
  }

  /**
   * Free worker on completion
   */
  async release(worker: T): Promise<void> {
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
  async process(src: WorkSet<X>, onComplete?: (val: X, i: number, total?: number) => (void | Promise<void>)): Promise<void> {
    const pending = new Set<Promise<unknown>>();
    let count = 0;

    while (await src.hasNext()) {
      const worker = (await this.#pool.acquire())!;
      if (this.#trace) {
        console.debug('Acquired', { pid: process.pid, worker: worker.id });
      }
      const nextInput = await src.next();

      const completion = worker.execute(nextInput)
        .catch(err => this.#errors.push(err)) // Catch error
        .finally(() => this.release(worker))
        .finally(() => onComplete?.(nextInput, count += 1, src.size));

      completion.finally(() => pending.delete(completion));

      pending.add(completion);
    }

    await Promise.all(Array.from(pending));

    if (this.#errors.length) {
      throw this.#errors[0];
    }
  }

  /**
   * Process a given input source as an iterator
   */
  async * iterateProcess(src: WorkSet<X>): AsyncIterable<TerminalProgressEvent> {
    const itr = new ManualAsyncIterator<TerminalProgressEvent>();
    const res = this.process(src, (val, i, total) => itr.add({ i, total, status: val !== undefined ? `${val}` : '' }));
    res.finally(() => itr.close());
    for (; ;) {
      const { value, done } = await itr.next();
      if (value) {
        yield value;
      }
      if (done) {
        break;
      }
    }
  }

  /**
   * Shutdown pool
   */
  async shutdown(): Promise<void> {
    while (this.#pendingAcquires) {
      await TimeUtil.wait(10);
    }
    await this.#pool.drain();
    await this.#pool.clear();
  }
}
