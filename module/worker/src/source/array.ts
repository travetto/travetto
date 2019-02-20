import { WorkerInputSource } from '../types';

export class WorkerArrayInputSource<X> implements WorkerInputSource<X> {
  position = 0;

  constructor(public items: X[]) { }

  hasNext() {
    return this.position < this.items.length;
  }

  next() {
    const ret = this.items[this.position];
    this.position++;
    return ret;
  }
}