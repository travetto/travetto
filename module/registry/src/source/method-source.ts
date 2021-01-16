import { EventEmitter } from 'events';

import { Class } from '@travetto/base';
import { ChangeSource, ChangeEvent } from '../types';

/**
 * Change source specific to individual methods of classes.  Useful
 * for method based registries
 */
export class MethodSource implements ChangeSource<[Class, Function]> {

  private events = new EventEmitter();

  /**
   * Define parent change source, generally will be the class source
   */
  constructor(public classSource: ChangeSource<Class>) {
    classSource.on(e => this.onClassEvent(e));
  }

  async init() { }

  emit(ev: ChangeEvent<[Class, Function]>) {
    this.events.emit('change', ev);
  }

  /**
   * On a class being emitted, check methods
   */
  onClassEvent(e: ChangeEvent<Class>) {
    const next = e.curr?.ᚕmethods ?? {};
    const prev = e.prev?.ᚕmethods ?? {};

    /**
     * Go through each method, comparing hashes.  To see added/removed and changed
     */
    for (const k of Object.keys(next)) {
      if (!prev[k]) {
        this.emit({ type: 'added', curr: [e.curr!, e.curr!.prototype[k]] });
      } else if (next[k].hash !== prev[k].hash) {
        this.emit({ type: 'changed', curr: [e.curr!, e.curr!.prototype[k]], prev: [e.prev!, e.prev!.prototype[k]] });
      } else {
        // Method Unchanged
      }
    }

    for (const k of Object.keys(prev)) {
      if (!next[k]) {
        this.emit({ type: 'removing', prev: [e.prev!, e.prev!.prototype[k]] });
      }
    }
  }

  on(callback: (e: ChangeEvent<[Class, Function]>) => void): this {
    this.events.on('change', callback);
    return this;
  }

  reset(): void { }
}