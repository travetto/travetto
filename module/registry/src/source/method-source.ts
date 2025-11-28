import { EventEmitter } from 'node:events';

import { Class, describeFunction } from '@travetto/runtime';

import { ChangeSource, ChangeEvent, ChangeHandler } from '../types.ts';

/**
 * Change source specific to individual methods of classes.  Useful
 * for method based registries
 */
export class MethodSource implements ChangeSource<[Class, Function]> {

  #emitter = new EventEmitter();

  /**
   * Define parent change source, generally will be the class source
   */
  constructor(classSource: ChangeSource<Class>) {
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
    const next = (e.type !== 'removing' ? describeFunction(e.curr!)?.methods : null) ?? {};
    const prev = (e.type !== 'added' ? describeFunction(e.prev!)?.methods : null) ?? {};

    /**
     * Go through each method, comparing hashes.  To see added/removed and changed
     */
    for (const k of Object.keys(next)) {
      if ((!prev[k] || !('prev' in e)) && e.type !== 'removing') {
        this.emit({ type: 'added', curr: [e.curr!, e.curr!.prototype[k]] });
      } else if (next[k].hash !== prev[k].hash && e.type === 'changed') {
        // FIXME: Why is e.prev undefined sometimes?
        this.emit({ type: 'changed', curr: [e.curr, e.curr.prototype[k]], prev: [e.prev, e.prev.prototype[k]] });
      } else {
        // Method Unchanged
      }
    }

    for (const k of Object.keys(prev)) {
      if (!next[k] && e.type !== 'added') {
        this.emit({ type: 'removing', prev: [e.prev, e.prev.prototype[k]] });
      }
    }
  }

  on(callback: ChangeHandler<[Class, Function]>): this {
    this.#emitter.on('change', callback);
    return this;
  }
}