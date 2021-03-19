import { EventEmitter } from 'events';

import { ScanEntry } from '@travetto/boot/src';

export type StandardEventType = 'added' | 'addedDir' | 'removed' | 'removedDir' | 'changed';
export type AllEvent = { event: StandardEventType, entry: ScanEntry };
type Handler<T> = (payload: T) => void;

/**
 * Standard pattern for watching and emitting
 */
export class WatchEmitter {
  private emitter = new EventEmitter();
  protected suppress = false;

  constructor(maxListeners = -1) {
    if (maxListeners > 0) {
      this.emitter.setMaxListeners(maxListeners);
    }
  }

  emit(type: 'all', payload: AllEvent): void;
  emit(type: StandardEventType, payload: ScanEntry): void;
  emit(type: 'error', payload: Error): void;
  emit(type: StandardEventType | 'all' | 'error', payload: unknown) {
    if (!this.suppress) {
      if (type !== 'all' && type !== 'error') {
        this.emitter.emit('all', { event: type, entry: payload });
      }
      this.emitter.emit(type, payload);
    }
  }

  on(type: 'all', handler: Handler<AllEvent>): this;
  on(type: StandardEventType, handler: Handler<ScanEntry>): this;
  on(type: 'error', handler: Handler<Error>): this;
  on(type: StandardEventType | 'all' | 'error', handler: Handler<any>): this {
    this.emitter.on(type, handler);
    return this;
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
  }
}