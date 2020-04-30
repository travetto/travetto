// TODO: Document
export interface InputSource<X> {
  hasNext(): boolean | Promise<boolean>;
  next(): X | Promise<X>;
}