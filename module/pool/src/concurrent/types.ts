export interface DataSource<T> {
  hasNext(): boolean;
  next(): T | Promise<T>;
}

export interface ConcurrentOp {
  kill(): any;
  release?: () => any;
  active: boolean;
}