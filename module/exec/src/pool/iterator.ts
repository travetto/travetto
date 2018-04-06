import { DataSource } from './types';

function isIterator<T>(o: any): o is Iterator<T> {
  return 'next' in o;
}

export class IteratorDataSource<T> implements DataSource<T> {

  done = false;
  private src: Iterator<T>

  constructor(src: (() => Iterator<T>) | Iterator<T>) {
    if (isIterator(src)) {
      this.src = src;
    } else {
      this.src = src();
    }
  }

  hasNext() {
    return !this.done;
  }

  next() {
    const res = this.src.next();
    if (res.done) {
      this.done = res.done;
    }
    return res.value;
  }
}