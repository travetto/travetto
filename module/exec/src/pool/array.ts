import { ExecutionSource } from './types';

export class ArrayExecutionSource<T> implements ExecutionSource<T> {
  position = 0;

  constructor(public items: T[]) { }

  hasNext() {
    return this.position < this.items.length;
  }

  next() {
    const ret = this.items[this.position];
    this.position++;
    return ret;
  }
}