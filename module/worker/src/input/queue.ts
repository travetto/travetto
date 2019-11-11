import { InputSource } from './types';

export class QueueInputSource<X> implements InputSource<X> {
  private items: X[] = [];

  constructor(data: X[] = [], private tick: number = 500) {
    this.items = data;
  }

  enqueue(item: X) {
    this.items.push(item);
  }

  hasNext() {
    return true; // Allows for adding to queue at runtime, cannot automatically kill
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