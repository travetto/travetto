export interface DataSource<T> {
  hasNext(): boolean;
  next(): T | Promise<T>;
}