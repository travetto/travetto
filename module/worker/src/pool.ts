import os from 'node:os';
import { Options, Pool, createPool } from 'generic-pool';

import { Env, Util } from '@travetto/runtime';

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

type WorkerInput<I, O> = (() => Worker<I, O>) | ((input: I, inputIdx: number) => Promise<O>);
type WorkPoolConfig<I, O> = Options & {
  onComplete?: (output: O, input: I, finishIdx: number) => void;
  onError?(ev: Error, input: I, finishIdx: number): (unknown | Promise<unknown>);
  shutdown?: AbortSignal;
};

const isWorkerFactory = <I, O>(o: WorkerInput<I, O>): o is (() => Worker<I, O>) => o.length === 0;

/**
 * Work pool support
 */
export class WorkPool {

  static MAX_SIZE = os.availableParallelism();
  static DEFAULT_SIZE = Math.min(WorkPool.MAX_SIZE, 4);

  /** Build worker pool */
  static #buildPool<I, O>(worker: WorkerInput<I, O>, opts?: WorkPoolConfig<I, O>): Pool<Worker<I, O>> {
    let pendingAcquires = 0;

    const trace = /@travetto\/worker/.test(Env.DEBUG.val ?? '');

    // Create the pool
    const pool = createPool({
      async create() {
        try {
          pendingAcquires += 1;
          const res = isWorkerFactory(worker) ? await worker() : { execute: worker };
          res.id ??= Util.uuid();

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
        await Util.nonBlockingTimeout(10);
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
    let inputIdx = 0;
    let finishIdx = 0;

    const pool = this.#buildPool(workerFactory, opts);

    for await (const nextInput of src) {
      const worker = await pool.acquire()!;

      if (trace) {
        console.debug('Acquired', { pid: process.pid, worker: worker.id });
      }

      const completion = worker.execute(nextInput, inputIdx += 1)
        .then(v => opts.onComplete?.(v, nextInput, finishIdx += 1))
        .catch(err => {
          errors.push(err);
          opts?.onError?.(err, nextInput, finishIdx += 1);
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
      onComplete: (ev, inp, finishIdx) => {
        itr.add(ev);
        opts?.onComplete?.(ev, inp, finishIdx);
      }
    });
    res.finally(() => itr.close());
    return itr;
  }

  /**
   * Process a given input source as an async iterable with progress information
   */
  static runStreamProgress<I, O>(worker: WorkerInput<I, O>, input: ItrSource<I>, total: number, opts?: WorkPoolConfig<I, O>): AsyncIterable<{
    idx: number;
    value: O;
    total: number;
  }> {
    const itr = new WorkQueue<{ idx: number, value: O, total: number }>();
    const res = this.run(worker, input, {
      ...opts,
      onComplete: (ev, inp, finishIdx) => {
        itr.add({ value: ev, idx: finishIdx, total });
        opts?.onComplete?.(ev, inp, finishIdx);
      }
    });
    res.finally(() => itr.close());
    return itr;
  }
}