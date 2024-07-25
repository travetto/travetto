import timers from 'node:timers/promises';
import { TimeSpan, TimeUtil, Util } from '@travetto/runtime';
import { ExecutionError } from './error';

/**
 * Timeout support, throws self on timeout
 */
export class Timeout extends ExecutionError {

  #timeout?: AbortController;
  #resolver = Util.resolvablePromise();
  #duration: number;

  constructor(duration: number | TimeSpan, op: string = 'Operation') {
    super(`${op} timed out after ${duration}${typeof duration === 'number' ? 'ms' : ''}`);
    this.#duration = TimeUtil.asMillis(duration);
  }

  /**
   * Stop timeout from firing
   */
  cancel(): void {
    if (this.#timeout) {
      this.#resolver.resolve();
      this.#timeout.abort();
      this.#timeout = undefined;
    }
  }

  /**
   * Wait for timeout as a promise
   */
  wait(): Promise<void> {
    if (!this.#timeout) {
      this.#timeout = new AbortController();
      timers.setTimeout(this.#duration, undefined, { ref: false, signal: this.#timeout.signal })
        .then(() => this.#resolver.reject(this))
        .catch(() => false);
    }
    return this.#resolver.promise;
  }
}
