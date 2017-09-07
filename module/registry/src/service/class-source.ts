import { Class } from '../model/types';
import { EventEmitter } from 'events';

export type ChangedEvent = { type: 'changed' | 'added' | 'removed' | 'init', prev?: Class, curr?: Class };

export class ClassSource {
  private events = new EventEmitter();

  emit(event: ChangedEvent) {
    this.events.emit('change', event);
  }

  on<T>(callback: (e: ChangedEvent) => any, filter?: (e: ChangedEvent) => boolean): void {
    this.events.on('change', filter ? e => filter(e) && callback(e) : callback);
  }
}