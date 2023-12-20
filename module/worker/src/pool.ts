import gp from 'generic-pool';
import os from 'node:os';
import timers from 'node:timers/promises';

import { Env, Util } from '@travetto/base';

import { WorkQueue } from './queue';

type ItrSource<I> = Iterable<I> | AsyncIterable<I>;

/**
 * Worker definition
 */
export interface Worker<I, O = unknown> {
  active?: boolean;
  id?: unknown;
  init?(): Promise<unknown>;
  execute(input: I, idx: number): Promise<O>;
  destroy?(): Promise<void>;
  release?(): unknown;
}

type WorkerInput<I, O> = (() => Worker<I, O>) | ((input: I, idx: number) => Promise<O>);
type WorkPoolConfig<I, O> = gp.Options & {
  onComplete?: (output: O, input: I, idx: number) => void;
  onError?(ev: Error, input: I, idx: number): (unknown | Promise<unknown>);
  shutdown?: AbortSignal;
};

const isWorkerFactory = <I, O>(o: WorkerInput<I, O>): o is (() => Worker<I, O>) => o.length === 0;

/**
 * Work pool support
 */
export class WorkPool {

  static MAX_SIZE = os.cpus().length - 1;
  static DEFAULT_SIZE = Math.min(WorkPool.MAX_SIZE, 4);

  /** Build worker pool */
  static #buildPool<I, O>(worker: WorkerInput<I, O>, opts?: WorkPoolConfig<I, O>): gp.Pool<Worker<I, O>> {
    let pendingAcquires = 0;

    const trace = /@travetto\/worker/.test(Env.DEBUG.val ?? '');

    // Create the pool
    const pool = gp.createPool({
      async create() {
        try {
          pendingAcquires += 1;
          const res = isWorkerFactory(worker) ? await worker() : { execute: worker };
          res.id ??= Util.shortHash(`${Math.random()}`);

          if (res.init) {
            await res.init();
          }

          return res;
        } finally {
          pendingAcquires -= 1;
        }
      },
      async destroy(x) {
        if (trace) {
          console.debug('Destroying', { pid: process.pid, worker: x.id });
        }
        return x.destroy?.();
      },
      validate: async (x: Worker<I, O>) => x.active ?? true
    }, {
      max: WorkPool.DEFAULT_SIZE,
      min: 1,
      evictionRunIntervalMillis: 5000,
      ...(opts ?? {}),
    });


    // Listen for shutdown
    opts?.shutdown?.addEventListener('abort', async () => {
      while (pendingAcquires) {
        await timers.setTimeout(10);
      }
      await pool.drain();
      await pool.clear();
    });

    return pool;
  }

  /**
   * Process a given input source and worker, and fire on completion
   */
  static async run<I, O>(workerFactory: WorkerInput<I, O>, src: ItrSource<I>, opts: WorkPoolConfig<I, O> = {}): Promise<void> {

    const trace = /@travetto\/worker/.test(Env.DEBUG.val ?? '');
    const pending = new Set<Promise<unknown>>();
    const errors: Error[] = [];
    let idx = 0;

    const pool = this.#buildPool(workerFactory, opts);

    for await (const nextInput of src) {
      const worker = await pool.acquire()!;

      if (trace) {
        console.debug('Acquired', { pid: process.pid, worker: worker.id });
      }

      const completion = worker.execute(nextInput, idx += 1)
        .then(v => opts.onComplete?.(v, nextInput, idx))
        .catch(err => {
          errors.push(err);
          opts?.onError?.(err, nextInput, idx);
        }) // Catch error
        .finally(async () => {
          if (trace) {
            console.debug('Releasing', { pid: process.pid, worker: worker.id });
          }
          try {
            if (worker.active ?? true) {
              try {
                await worker.release?.();
              } catch { }
              await pool.release(worker);
            } else {
              await pool.destroy(worker);
            }
          } catch { }
        });

      completion.finally(() => pending.delete(completion));
      pending.add(completion);
    }

    await Promise.all(Array.from(pending));

    if (errors.length) {
      throw errors[0];
    }
  }

  /**
   * Process a given input source as an async iterable
   */
  static runStream<I, O>(worker: WorkerInput<I, O>, input: ItrSource<I>, opts?: WorkPoolConfig<I, O>): AsyncIterable<O> {
    const itr = new WorkQueue<O>();
    const res = this.run(worker, input, {
      ...opts,
      onComplete: (ev, inp, idx) => {
        itr.add(ev);
        opts?.onComplete?.(ev, inp, idx);
      }
    });
    res.finally(() => itr.close());
    return itr;
  }
}