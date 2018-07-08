import { DataSource } from './types';

export class ArrayDataSource<T> implements DataSource<T> {
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