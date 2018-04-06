import { DataSource } from './types';

function isIterator<T>(o: any): o is Iterator<T> {
  return 'next' in o;
}

export class IteratorDataSource<T> implements DataSource<T> {

  done = false;
  private src: Iterator<T>
  private ondeck: T;

  constructor(src: (() => Iterator<T>) | Iterator<T>) {
    if (isIterator(src)) {
      this.src = src;
    } else {
      this.src = src();
    }
  }

  private primeNext() {
    const res = this.src.next();
    this.done = res.done;
    this.ondeck = res.value;
  }

  hasNext() {
    if (this.ondeck === undefined) {
      this.primeNext();
    }
    return !this.done;
  }

  next() {
    this.hasNext();

    const out = this.ondeck;
    delete this.ondeck;
    return out;
  }
}