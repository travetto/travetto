import type { Options } from 'generic-pool';

import { RuntimeError } from '@travetto/runtime';

export type IterableSource<I> = Iterable<I> | AsyncIterable<I>;
export type WorkerExecutor<I, O> = (input: I, idx: number) => Promise<O>;

/**
 * WorkPool results error.
 *
 * Hold all the errors for a given work pool execution
 */
export class WorkPoolResultError extends RuntimeError<{ errors: Error[] }> {
  constructor(errors: Error[]) {
    super('WorkPool errors have occurred', { category: 'data', details: { errors } });
  }
}

/**
 * Worker definition
 */
export interface Worker<I, O = unknown> {
  active: boolean;
  id: unknown;
  init?(): Promise<unknown>;
  execute: WorkerExecutor<I, O>;
  destroy?(): Promise<void>;
  release?(): unknown;
}

export type WorkPoolProgress = {
  total: number;
  completed: number;
  failed: number;
};

export type WorkPoolCompleteEvent<I, O> = {
  output: O;
  input: I;
  success: boolean;
  progress: WorkPoolProgress;
};

export type WorkPoolErrorEvent<I> = {
  error: Error;
  input: I;
  progress: WorkPoolProgress;
};

export type WorkerFactoryInput<I, O = unknown> = Partial<Worker<I, O>> & { execute: WorkerExecutor<I, O> };
export type WorkerInput<I, O> = (() => (WorkerFactoryInput<I, O> | Promise<WorkerFactoryInput<I, O>>)) | WorkerExecutor<I, O>;
export type WorkPoolConfig<I, O> = Options & {
  isSuccess?: (output: O) => boolean;
  onComplete?: (event: WorkPoolCompleteEvent<I, O>) => void | Promise<void>;
  onError?<R = unknown>(event: WorkPoolErrorEvent<I>): (R | Promise<R>);
  shutdown?: AbortSignal;
  total?: number;
};

export const isWorkerFactory = <I, O>(value: WorkerInput<I, O>): value is (() => (WorkerFactoryInput<I, O> | Promise<WorkerFactoryInput<I, O>>)) => value.length === 0;