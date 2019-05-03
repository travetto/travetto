import { InputSource } from './types';

type Itr<T> = Iterator<T> | AsyncIterator<T>;

function isIterator<T>(o: any): o is Itr<T> {
  return 'next' in o;
}

export class IteratorInputSource<X> implements InputSource<X> {

  private src: Itr<X>;
  private ondeck: X;
  done = false;

  constructor(src: (() => Itr<X>) | Itr<X>) {
    if (isIterator(src)) {
      this.src = src;
    } else {
      this.src = src();
    }
  }

  private async primeNext() {
    const res = await this.src.next();
    this.done = res.done;
    this.ondeck = res.value;
  }

  async hasNext() {
    if (this.ondeck === undefined) {
      await this.primeNext();
    }
    return !this.done;
  }

  async next() {
    await this.hasNext();

    const out = this.ondeck;
    delete this.ondeck;
    return out;
  }
}