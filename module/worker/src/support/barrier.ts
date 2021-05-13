import { Util, ShutdownManager, TimeSpan } from '@travetto/base';
import { Timeout } from './timeout';

function canCancel(o: unknown): o is { cancel(): unknown } {
  return !!o && 'cancel' in (o as object);
}

/**
 * Build an execution barrier to handle various limitations
 */
export class Barrier {
  #support = [] as string[];
  #barriers = new Map<string, Promise<unknown>>([]);

  constructor(
    timeout?: number | TimeSpan,
    unhandled?: boolean
  ) {
    if (timeout !== undefined) {
      this.add(new Timeout(timeout).wait(), true);
    }
    if (unhandled) {
      this.add(ShutdownManager.listenForUnhandled());
    }
  }

  /**
   * Add a new barrier
   */
  add(p: (() => Promise<unknown>) | Promise<unknown>, support = false) {
    if (!('then' in p)) {
      p = p();
    }
    const k = Util.uuid();
    p = p
      .finally(() => this.#barriers.delete(k))
      .catch(err => { this.cleanup(); throw err; });

    if (!support) {
      p = p.then(() => this.cleanup());
    } else {
      this.#support.push(k);
    }

    this.#barriers.set(k, p);
    return this;
  }

  /**
   * Clean up, and cancel all cancellable barriers
   */
  cleanup() {
    for (const k of this.#support) {
      const el = this.#barriers.get(k);
      if (canCancel(el)) {
        el.cancel();
      }
    }
    this.#barriers.clear();
  }

  /**
   * Wait for all barriers to clear out
   */
  async wait(): Promise<Error | undefined> {
    let err: Error | undefined;
    // Wait for all barriers to be satisfied
    while (this.#barriers.size) {
      await Promise.race(this.#barriers.values()).catch(e => err ??= e);
    }
    return err;
  }
}