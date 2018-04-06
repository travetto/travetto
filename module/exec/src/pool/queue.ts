import { DataSource } from './types';

export class QueueDataSource<T> implements DataSource<T> {
  private items: T[] = [];

  constructor(data?: T[], private tick: number = 500) {
    this.items = data || [];
  }

  enqueue(item: T) {
    this.items.push(item);
  }

  hasNext() {
    return true;
  }

  async next() {
    while (true) {
      if (this.items.length) {
        return this.items.shift()!;
      } else {
        await new Promise(r => setTimeout(r, this.tick));
      }
    }
  }
}