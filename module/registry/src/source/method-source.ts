import { EventEmitter } from 'node:events';

import { Class, describeFunction } from '@travetto/runtime';

import { ChangeSource, ChangeEvent, ChangeHandler } from '../types.ts';

/**
 * Change source specific to individual methods of classes.  Useful
 * for method based registries
 */
export class MethodChangeSource implements ChangeSource<[Class, Function]> {

  #emitter = new EventEmitter();

  /**
   * Define parent change source, generally will be the class source
   */
  constructor(classSource: ChangeSource<Class>) {
    classSource.on(event => this.onClassEvent(event));
  }

  emit(event: ChangeEvent<[Class, Function]>): void {
    this.#emitter.emit('change', event);
  }

  /**
   * On a class being emitted, check methods
   */
  onClassEvent(event: ChangeEvent<Class>): void {
    const next = (event.type !== 'delete' ? describeFunction(event.current!)?.methods : null) ?? {};
    const previous = (event.type !== 'create' ? describeFunction(event.previous!)?.methods : null) ?? {};

    /**
     * Go through each method, comparing hashes.  To see added/removed and changed
     */
    for (const key of Object.keys(next)) {
      if ((!previous[key] || !('previous' in event)) && event.type !== 'delete') {
        this.emit({ type: 'create', current: [event.current!, event.current!.prototype[key]] });
      } else if (next[key].hash !== previous[key].hash && event.type === 'update') {
        // FIXME: Why is event.previous undefined sometimes?
        this.emit({
          type: 'update',
          current: [event.current, event.current.prototype[key]],
          previous: [event.previous, event.previous.prototype[key]]
        });
      } else {
        // Method Unchanged
      }
    }

    for (const key of Object.keys(previous)) {
      if (!next[key] && event.type !== 'create') {
        this.emit({ type: 'delete', previous: [event.previous, event.previous.prototype[key]] });
      }
    }
  }

  on(callback: ChangeHandler<[Class, Function]>): this {
    this.#emitter.on('change', callback);
    return this;
  }
}