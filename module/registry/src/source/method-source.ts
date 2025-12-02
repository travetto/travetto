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
    classSource.on(event => this.onClassEvent(event));
  }

  async init(): Promise<void> { }

  emit(ev: ChangeEvent<[Class, Function]>): void {
    this.#emitter.emit('change', ev);
  }

  /**
   * On a class being emitted, check methods
   */
  onClassEvent(event: ChangeEvent<Class>): void {
    const next = (event.type !== 'removing' ? describeFunction(event.curr!)?.methods : null) ?? {};
    const prev = (event.type !== 'added' ? describeFunction(event.prev!)?.methods : null) ?? {};

    /**
     * Go through each method, comparing hashes.  To see added/removed and changed
     */
    for (const k of Object.keys(next)) {
      if ((!prev[k] || !('prev' in event)) && event.type !== 'removing') {
        this.emit({ type: 'added', curr: [event.curr!, event.curr!.prototype[k]] });
      } else if (next[k].hash !== prev[k].hash && event.type === 'changed') {
        // FIXME: Why is event.prev undefined sometimes?
        this.emit({ type: 'changed', curr: [event.curr, event.curr.prototype[k]], prev: [event.prev, event.prev.prototype[k]] });
      } else {
        // Method Unchanged
      }
    }

    for (const k of Object.keys(prev)) {
      if (!next[k] && event.type !== 'added') {
        this.emit({ type: 'removing', prev: [event.prev, event.prev.prototype[k]] });
      }
    }
  }

  on(callback: ChangeHandler<[Class, Function]>): this {
    this.#emitter.on('change', callback);
    return this;
  }
}