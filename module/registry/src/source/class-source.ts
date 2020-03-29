import { EventEmitter } from 'events';

import { Compiler } from '@travetto/compiler';

import { Class, ChangeSource, ChangeEvent } from '../types';
import { PendingRegister } from '../decorator';

export class ClassSource implements ChangeSource<Class> {

  private classes = new Map<string, Map<string, Class>>();
  private events = new EventEmitter();

  constructor() {
    Compiler.on('added', file => {
      this.handlePendingFileChanges();
      this.flush();
    });

    Compiler.on('changed', file => {
      this.handlePendingFileChanges();
    });
  }

  private flush() {
    for (const [file, classes] of PendingRegister.flush()) {
      if (!classes || !classes.length) {
        continue;
      }
      this.classes.set(file, new Map());
      for (const cls of classes) {
        this.classes.get(cls.__file)!.set(cls.__id, cls);
        this.emit({ type: 'added', curr: cls });
      }
    }
  }

  protected async handleFileChanges(file: string, classes: Class<any>[] = []) {
    const next = new Map(classes.map(cls => [cls.__id, cls] as [string, Class]));

    let prev = new Map<string, Class>();
    if (this.classes.has(file)) {
      prev = new Map(this.classes.get(file)!.entries());
    }

    const keys = new Set([...Array.from(prev.keys()), ...Array.from(next.keys())]);

    if (!this.classes.has(file)) {
      this.classes.set(file, new Map());
    }

    for (const k of keys) {
      if (!next.has(k)) {
        this.emit({ type: 'removing', prev: prev.get(k)! });
        this.classes.get(file)!.delete(k);
      } else {
        this.classes.get(file)!.set(k, next.get(k)!);
        if (!prev.has(k)) {
          this.emit({ type: 'added', curr: next.get(k)! });
        } else if (prev.get(k)!.__hash !== next.get(k)!.__hash) {
          this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
        }
      }
    }
  }

  handlePendingFileChanges() {
    console.trace('Pending changes', PendingRegister.ordered);
    for (const [file, classes] of PendingRegister.flush()) {
      this.handleFileChanges(file, classes);
    }
  }

  emit(e: ChangeEvent<Class>) {
    console.trace('Emitting change', e.type, e.curr && e.curr.__id, e.prev && e.prev.__id);
    this.events.emit('change', e);
  }

  reset() {
    this.classes.clear();
  }

  async init() {
    this.flush();
  }

  on(callback: (e: ChangeEvent<Class>) => void): void {
    this.events.on('change', callback);
  }
}