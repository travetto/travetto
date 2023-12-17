import os from 'node:os';
import gp from 'generic-pool';
import timers from 'node:timers/promises';

import { Env, Util } from '@travetto/base';

import { WorkQueue } from './queue';

/**
 * Worker definition
 */
export interface Worker<I, O = unknown> {
  active?: boolean;
  id?: unknown;
  init?(): Promise<unknown>;
  execute(input: I): Promise<O>;
  destroy?(): Promise<void>;
  release?(): unknown;
}

type WorkCompletion<I, O> = { idx: number, input: I, result: O, total?: number };
type WorkError<I> = { idx: number, input: I, error: Error, total?: number };
type WorkerInput<I, O> = (() => Worker<I, O>) | ((input: I) => Promise<O>);
type ItrSource<I> = Iterable<I> | AsyncIterable<I>;

const isWorkerFactory = <I, O>(o: WorkerInput<I, O>): o is (() => Worker<I, O>) => o.length === 0;

type WorkPoolStreamConfig<I, O> = gp.Options & {
  onError?(ev: WorkError<I>): (unknown | Promise<unknown>);
  shutdown?: AbortSignal;
  total?: number;
};

type WorkPoolConfig<I, O> = WorkPoolStreamConfig<I, O> & {
  onComplete?: (ev: WorkCompletion<I, O>) => void;
};


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

      const completion = worker.execute(nextInput)
        .then(v => opts.onComplete?.({ input: nextInput, idx: idx += 1, result: v, total: opts?.total }))
        .catch(err => {
          errors.push(err);
          opts?.onError?.({ input: nextInput, idx: idx += 1, error: err, total: opts?.total });
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
  static runStream<I, O>(worker: WorkerInput<I, O>, input: ItrSource<I>, opts?: WorkPoolStreamConfig<I, O>): AsyncIterable<O> {
    const itr = new WorkQueue<O>();
    const res = this.run(worker, input, { ...opts, onComplete: ev => itr.add(ev.result) });
    res.finally(() => itr.close());
    return itr;
  }

  /**
   * Process a given input source as an async iterable, with progress information
   */
  static runProgressStream<I, O>(worker: WorkerInput<I, O>, input: ItrSource<I>, opts?: WorkPoolStreamConfig<I, O>): AsyncIterable<WorkCompletion<I, O>> {
    const itr = new WorkQueue<WorkCompletion<I, O>>();
    const res = this.run(worker, input, { ...opts, onComplete: ev => itr.add(ev) });
    res.finally(() => itr.close());
    return itr;
  }
}