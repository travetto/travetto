import { DataSource } from './types';

export class GeneratorDataSource<T> implements DataSource<T> {

  constructor(public src: () => Promise<T>) { }

  hasNext() {
    return true;
  }

  next() {
    return this.src();
  }
}