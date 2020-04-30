import { EventEmitter } from 'events';

import { Class, ChangeSource, ChangeEvent } from '../types';

// TODO: Document
export class MethodSource implements ChangeSource<[Class, Function]> {

  private events = new EventEmitter();

  constructor(public classSource: ChangeSource<Class>) {
    classSource.on(e => this.onClassEvent(e));
  }

  async init() { }

  emit(ev: ChangeEvent<[Class, Function]>) {
    this.events.emit('change', ev);
  }

  onClassEvent(e: ChangeEvent<Class>) {
    const next = e.curr?.__methods ?? {};
    const prev = e.prev?.__methods ?? {};

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

  on(callback: (e: ChangeEvent<[Class<any>, Function]>) => void): void {
    this.events.on('change', callback);
  }

  reset(): void { }
}