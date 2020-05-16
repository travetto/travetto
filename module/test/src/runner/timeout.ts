import { EventEmitter } from 'events';
import { ExecutionError } from './error';

const PROM = Promise;

/**
 * Timeout support, throws self on timeout
 */
export class Timeout extends ExecutionError {

  private id: NodeJS.Timer;
  private listener: EventEmitter;

  constructor(private duration: number, op: string = 'Operation') {
    super(`${op} timed out after ${duration}ms`);
    this.listener = new EventEmitter();
  }

  /**
   * Stop timeout from firing
   */
  cancel() {
    clearTimeout(this.id);
    this.listener.removeAllListeners('timeout');
    delete this.id;
  }

  /**
   * Wait for timeout as a promise
   */
  wait() {
    if (!this.id) {
      this.id = setTimeout(() => this.listener.emit('timeout'), this.duration);
      this.id.unref();
    }
    return new PROM<Error>((__, rej) => this.listener.on('timeout', () => rej(this)));
  }
}
