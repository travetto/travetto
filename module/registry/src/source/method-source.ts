import { EventEmitter } from 'node:events';

import { Class } from '@travetto/base';
import { RuntimeIndex } from '@travetto/manifest';

import { ChangeSource, ChangeEvent, ChangeHandler } from '../types';

/**
 * Change source specific to individual methods of classes.  Useful
 * for method based registries
 */
export class MethodSource implements ChangeSource<[Class, Function]> {

  #emitter = new EventEmitter();

  /**
   * Define parent change source, generally will be the class source
   */
  constructor(public classSource: ChangeSource<Class>) {
    classSource.on(e => this.onClassEvent(e));
  }

  async init(): Promise<void> { }

  emit(ev: ChangeEvent<[Class, Function]>): void {
    this.#emitter.emit('change', ev);
  }

  /**
   * On a class being emitted, check methods
   */
  onClassEvent(e: ChangeEvent<Class>): void {
    const next = RuntimeIndex.getFunctionMetadataFromClass(e.curr!)?.methods ?? {};
    const prev = RuntimeIndex.getFunctionMetadataFromClass(e.prev!)?.methods ?? {};

    /**
     * Go through each method, comparing hashes.  To see added/removed and changed
     */
    for (const k of Object.keys(next)) {
      if (!prev[k] || !e.prev) {
        this.emit({ type: 'added', curr: [e.curr!, e.curr!.prototype[k]] });
      } else if (next[k].hash !== prev[k].hash && e.curr) {
        // FIXME: Why is e.prev undefined sometimes?
        this.emit({ type: 'changed', curr: [e.curr, e.curr.prototype[k]], prev: [e.prev, e.prev.prototype[k]] });
      } else {
        // Method Unchanged
      }
    }

    for (const k of Object.keys(prev)) {
      if (!next[k] && e.prev) {
        this.emit({ type: 'removing', prev: [e.prev, e.prev.prototype[k]] });
      }
    }
  }

  on(callback: ChangeHandler<[Class, Function]>): this {
    this.#emitter.on('change', callback);
    return this;
  }
}