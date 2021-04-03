import { Util } from '@travetto/base';
import { ExecutionError } from './error';

/**
 * Timeout support, throws self on timeout
 */
export class Timeout extends ExecutionError {

  #id: NodeJS.Timer | undefined;
  #promise = Util.resolvablePromise();
  #duration: number;

  constructor(duration: number, op: string = 'Operation') {
    super(`${op} timed out after ${duration}ms`);
    this.#duration = duration;
  }

  /**
   * Stop timeout from firing
   */
  cancel() {
    if (this.#id) {
      clearTimeout(this.#id);
      this.#promise.resolve();
      this.#id = undefined;
    }
  }

  /**
   * Wait for timeout as a promise
   */
  wait() {
    if (!this.#id) {
      this.#id = setTimeout(() => this.#promise.reject(this), this.#duration);
      this.#id.unref();
    }
    return this.#promise;
  }
}
