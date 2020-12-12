import { Util } from '@travetto/base';
import { ExecutionError } from './error';

/**
 * Timeout support, throws self on timeout
 */
export class Timeout extends ExecutionError {

  private id: NodeJS.Timer | undefined;
  private promise = Util.resolvablePromise();

  constructor(private duration: number, op: string = 'Operation') {
    super(`${op} timed out after ${duration}ms`);
  }

  /**
   * Stop timeout from firing
   */
  cancel() {
    if (this.id) {
      clearTimeout(this.id);
      this.promise.resolve();
      delete this.id;
    }
  }

  /**
   * Wait for timeout as a promise
   */
  wait() {
    if (!this.id) {
      this.id = setTimeout(() => this.promise.reject(this), this.duration);
      this.id.unref();
    }
    return this.promise;
  }
}
