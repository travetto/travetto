import { Util } from '@travetto/base';
import { InputSource } from './types';

/**
 * Event based input source, listens for events and drives new work for each event
 */
export class EventInputSource<X> implements InputSource<X> {

  queue: X[] = [];
  ready = Util.resolvablePromise();

  /**
   * Initial set of items
   */
  constructor(initial: Iterable<X> = []) {
    this.queue.push(...initial);
  }

  /**
   * Never ennds
   */
  hasNext() {
    return true;
  }

  /**
   * Wait for next event to fire
   */
  async next() {
    if (!this.queue.length) {
      await this.ready;
      this.ready = Util.resolvablePromise();
    }
    return this.queue.shift()!;
  }

  /**
   * Trigger next event to fire
   * @param {boolean} immediate Determines if item(s) should be append or preppended to the queue
   */
  trigger(item: X | X[], immediate = false) {
    item = Array.isArray(item) ? item : [item];
    if (!immediate) {
      this.queue.push(...item);
    } else {
      this.queue.unshift(...item);
    }
    this.ready.resolve();
  }
}