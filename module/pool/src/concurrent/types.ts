export interface DataSource<T> {
  hasNext(): boolean;
  next(): T | Promise<T>;
}

export interface ConcurrentOp {
  active: boolean;
  kill(): any;
  release?(): any;
}