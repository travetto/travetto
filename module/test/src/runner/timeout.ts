import { EventEmitter } from 'events';

const PROM = Promise;

/**
 * Timeout support, throws self on timeout
 */
export class Timeout extends Error {

  private id: NodeJS.Timer;
  private listener: EventEmitter;

  constructor(private duration: number, op: string = 'Operation') {
    super(`${op} timed out after ${duration}ms`);
    this.listener = new EventEmitter();
  }

  cancel() {
    clearTimeout(this.id);
    this.listener.removeAllListeners('timeout');
    delete this.id;
  }

  wait() {
    if (!this.id) {
      this.id = setTimeout(() => this.listener.emit('timeout'), this.duration);
      this.id.unref();
    }
    return new PROM<Error>((__, rej) => this.listener.on('timeout', () => rej(this)));
  }
}
