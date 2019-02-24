import { InputSource } from './types';

export class ArrayInputSource<X> implements InputSource<X> {
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