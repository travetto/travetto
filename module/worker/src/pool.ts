import os from 'node:os';
import { type Pool, createPool } from 'generic-pool';

import { Env, Util, AsyncQueue } from '@travetto/runtime';

import {
  isWorkerFactory,
  WorkPoolResultError,
  type IterableSource,
  type Worker,
  type WorkerInput,
  type WorkPoolCompleteEvent,
  type WorkPoolConfig,
  type WorkPoolProgress
} from './types.ts';

/**
 * Work pool support
 */
export class WorkPool {
  static MAX_SIZE = os.availableParallelism();
  static DEFAULT_SIZE = Math.max(Math.trunc(WorkPool.MAX_SIZE * 0.75), 4);

  static #shouldTrace(): boolean {
    return (Env.DEBUG.value ?? '').includes('@travetto/worker');
  }

  /** Build worker pool */
  static #buildPool<I, O>(input: WorkerInput<I, O>, options?: WorkPoolConfig<I, O>): Pool<Worker<I, O>> {
    let pendingAcquires = 0;

    const trace = this.#shouldTrace();

    // Create the pool
    const pool = createPool(
      {
        async create() {
          try {
            pendingAcquires += 1;
            const factoryInput = isWorkerFactory(input) ? await input() : { execute: input };
            const worker: Worker<I, O> = {
              id: Util.uuid(),
              active: true,
              ...factoryInput
            };
            await worker.init?.();
            return worker;
          } finally {
            pendingAcquires -= 1;
          }
        },
        async destroy(worker) {
          if (trace) {
            console.debug('Destroying', { pid: process.pid, worker: worker.id });
          }
          return worker.destroy?.();
        },
        validate: async (worker: Worker<I, O>) => worker.active
      },
      {
        evictionRunIntervalMillis: 5000,
        ...(options ?? {}),
        max: options?.max ?? WorkPool.DEFAULT_SIZE,
        min: options?.min ?? 1
      }
    );

    // Listen for shutdown
    options?.shutdown?.addEventListener('abort', async () => {
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
  static async run<I, O>(workerFactory: WorkerInput<I, O>, source: IterableSource<I>, options: WorkPoolConfig<I, O> = {}): Promise<void> {
    const trace = this.#shouldTrace();
    const pending = new Set<Promise<unknown>>();
    const errors: Error[] = [];
    let inputIdx = 0;

    const pool = this.#buildPool(workerFactory, options);

    const progress: WorkPoolProgress = {
      completed: 0,
      total: options.total ?? 0,
      failed: 0
    };

    for await (const nextInput of source) {
      const worker = await pool.acquire()!;

      if (trace) {
        console.debug('Acquired', { pid: process.pid, worker: worker.id });
      }
      if (!options.total) {
        progress.total = inputIdx + 1;
      }

      const completion = worker
        .execute(nextInput, (inputIdx += 1))
        .then(output => {
          const success = options.isSuccess?.(output) ?? true;
          progress.failed += +!success;
          progress.completed += 1;
          return options.onComplete?.({ output, input: nextInput, success, progress });
        })
        .catch(error => {
          errors.push(error);
          progress.failed += 1;
          progress.completed += 1;
          options?.onError?.({ error, input: nextInput, progress });
        }) // Catch error
        .finally(async () => {
          if (trace) {
            console.debug('Releasing', { pid: process.pid, worker: worker.id });
          }
          try {
            if (worker.active) {
              try {
                await worker.release?.();
              } catch {}
              await pool.release(worker);
            } else {
              await pool.destroy(worker);
            }
          } catch {}
        });

      completion.finally(() => pending.delete(completion));
      pending.add(completion);
    }

    await Promise.all(Array.from(pending));

    if (errors.length) {
      throw new WorkPoolResultError(errors);
    }
  }

  /**
   * Process a given input source as an async iterable with progress information
   */
  static runStream<I, O>(
    worker: WorkerInput<I, O>,
    source: IterableSource<I>,
    options?: WorkPoolConfig<I, O>
  ): AsyncIterable<WorkPoolCompleteEvent<I, O>> {
    const queue = new AsyncQueue<WorkPoolCompleteEvent<I, O>>();
    const result = this.run(worker, source, {
      ...options,
      onComplete: async event => {
        await options?.onComplete?.(event);
        queue.add(event);
        return;
      }
    });
    result.finally(() => queue.close());
    return queue;
  }
}
