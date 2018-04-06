export interface DataSource<T> {
  hasNext(): boolean;
  next(): Promise<T>;
}