import { Util } from '@travetto/base';

/**
 * Build an execution barrier to handle various limitations
 */
export class Barrier {
  private support = [] as string[];
  private barriers = new Map<string, Promise<any>>([]);

  constructor() { }

  /**
   * Add a new barrier
   */
  add(p: (() => Promise<any>) | Promise<any>, support = false) {
    if (!('then' in p)) {
      p = p();
    }
    const k = Util.uuid();
    p = p
      .finally(() => this.barriers.delete(k))
      .catch(err => { this.cleanup(); throw err; });

    if (!support) {
      p = p.then(() => this.cleanup());
    } else {
      this.support.push(k);
    }

    this.barriers.set(k, p);
    return p;
  }

  /**
   * Clean up, and cancel all cancellable barriers
   */
  cleanup() {
    for (const k of this.support) {
      const el = this.barriers.get(k);
      if (el && 'cancel' in el) {
        // @ts-ignore
        el.cancel();
      }
    }
    this.barriers.clear();
  }

  /**
   * Wait for all barriers to clear out
   */
  async wait(): Promise<Error | undefined> {
    let err: Error | undefined;
    // Wait for all barriers to be satisifed
    while (this.barriers.size) {
      await Promise.race(this.barriers.values()).catch(e => err = e);
    }
    return err;
  }
}