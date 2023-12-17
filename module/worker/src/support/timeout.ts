import { clearTimeout } from 'node:timers';
import { TimeSpan, TimeUtil, Util } from '@travetto/base';
import { ExecutionError } from './error';

/**
 * Timeout support, throws self on timeout
 */
export class Timeout extends ExecutionError {

  #id: ReturnType<typeof setTimeout> | undefined;
  #promise = Util.resolvablePromise();
  #duration: number;

  constructor(duration: number | TimeSpan, op: string = 'Operation') {
    super(`${op} timed out after ${duration}${typeof duration === 'number' ? 'ms' : ''}`);
    this.#duration = TimeUtil.timeToMs(duration);
  }

  /**
   * Stop timeout from firing
   */
  cancel(): void {
    if (this.#id) {
      clearTimeout(this.#id);
      this.#promise.resolve();
      this.#id = undefined;
    }
  }

  /**
   * Wait for timeout as a promise
   */
  wait(): Promise<void> {
    if (!this.#id) {
      this.#id = setTimeout(() => this.#promise.reject(this), this.#duration);
      this.#id.unref();
    }
    return this.#promise;
  }
}
