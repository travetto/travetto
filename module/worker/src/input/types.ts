export interface InputSource<X> {
  hasNext(): boolean;
  next(): X | Promise<X>;
}