import { ChangeSource, ChangeEvent } from './types';
import { Class } from '../model';
import { EventEmitter } from 'events';

export class CompilerMethodSource implements ChangeSource<[Class, Function]> {

  private events = new EventEmitter();

  constructor(public classSource: ChangeSource<Class>) {
    classSource.on(e => this.onClassEvent(e));
  }

  async init() { }

  emit(ev: ChangeEvent<[Class, Function]>) {
    this.events.emit('change', ev)
  }

  onClassEvent(e: ChangeEvent<Class>) {
    const next = (e.curr ? e.curr!.__methodHashes : null) || {};
    const prev = (e.prev ? e.prev!.__methodHashes : null) || {};

    for (const k of Object.keys(next)) {
      if (!prev[k]) {
        this.emit({ type: 'added', curr: [e.curr!, e.curr!.prototype[k]] });
      } else if (next[k] !== prev[k]) {
        this.emit({ type: 'changed', curr: [e.curr!, e.curr!.prototype[k]], prev: [e.prev!, e.prev!.prototype[k]] });
      } else {
        console.log('Method unchanged');
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