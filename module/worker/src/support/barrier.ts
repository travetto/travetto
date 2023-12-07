import { setTimeout } from 'timers/promises';

import { TimeSpan, Util } from '@travetto/base';

import { Timeout } from './timeout';

function canCancel(o: unknown): o is { cancel(): unknown } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!o && 'cancel' in (o as object);
}

/**
 * Build an execution barrier to handle various limitations
 */
export class Barrier {
  /**
   * Listen for an unhandled event, as a promise
   */
  static listenForUnhandled(): Promise<never> & { cancel: () => void } {
    const uncaught = Util.resolvablePromise<never>();
    const uncaughtWithCancel: typeof uncaught & { cancel?: () => void } = uncaught;
    const onError = (err: Error): void => { setTimeout(1).then(() => uncaught.reject(err)); };
    process.on('unhandledRejection', onError).on('uncaughtException', onError);
    const cancel = (): void => {
      process.off('unhandledRejection', onError).off('unhandledException', onError);
    };
    uncaughtWithCancel.cancel = (): void => {
      cancel(); // Remove the handler
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      uncaughtWithCancel.resolve(undefined as never); // Close the promise
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return uncaughtWithCancel as (Promise<never> & { cancel: () => void });
  }

  #support: string[] = [];
  #barriers = new Map<string, Promise<unknown>>([]);

  constructor(
    timeout?: number | TimeSpan,
    unhandled?: boolean
  ) {
    if (timeout !== undefined) {
      this.add(new Timeout(timeout).wait(), true);
    }
    if (unhandled) {
      this.add(Barrier.listenForUnhandled());
    }
  }

  /**
   * Add a new barrier
   */
  add(p: (() => Promise<unknown>) | Promise<unknown>, support = false): this {
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
  cleanup(): void {
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
    let capturedError: Error | undefined;
    // Wait for all barriers to be satisfied
    while (this.#barriers.size) {
      await Promise.race(this.#barriers.values()).catch(err => capturedError ??= err);
    }
    return capturedError;
  }
}