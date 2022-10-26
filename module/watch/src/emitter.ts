import { EventEmitter } from 'events';

import type { ScanEntry } from '@travetto/base';

export type StandardEventType = 'added' | 'addedDir' | 'removed' | 'removedDir' | 'changed';
export type AllEvent = { event: StandardEventType, entry: ScanEntry };
type Handler<T> = (payload: T) => void;

/**
 * Standard pattern for watching and emitting
 */
export class WatchEmitter {
  protected suppress = false;

  #emitter = new EventEmitter();

  constructor(maxListeners = -1) {
    if (maxListeners > 0) {
      this.#emitter.setMaxListeners(maxListeners);
    }
  }

  emit(type: 'all', payload: AllEvent): void;
  emit(type: StandardEventType, payload: ScanEntry): void;
  emit(type: 'error', payload: Error): void;
  emit(type: StandardEventType | 'all' | 'error', payload: unknown): void {
    if (!this.suppress) {
      if (type !== 'all' && type !== 'error') {
        this.#emitter.emit('all', { event: type, entry: payload });
      }
      this.#emitter.emit(type, payload);
    }
  }

  on(type: 'all', handler: Handler<AllEvent>): this;
  on(type: StandardEventType, handler: Handler<ScanEntry>): this;
  on(type: 'error', handler: Handler<Error>): this;
  on<T extends AllEvent | ScanEntry | Error>(type: StandardEventType | 'all' | 'error', handler: Handler<T>): this {
    this.#emitter.on(type, handler);
    return this;
  }

  removeAllListeners(): void {
    this.#emitter.removeAllListeners();
  }
}