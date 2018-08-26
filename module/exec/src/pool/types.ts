export interface ExecutionSource<T> {
  hasNext(): boolean;
  next(): T | Promise<T>;
}

export interface ConcurrentExecution {
  active: boolean;
  kill(): any;
  release?(): any;
}