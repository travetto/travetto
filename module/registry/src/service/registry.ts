import * as path from 'path';
import { EventEmitter } from 'events';

import { bulkRequire, AppEnv, externalPromise, bulkFind } from '@encore2/base';
import { RetargettingHandler, Compiler } from '@encore2/compiler';
import { Class } from '../model/types';

export abstract class Registry {

  classes = new Map<string, Map<string, Class>>();
  events = new EventEmitter();
  initialized = externalPromise();
  dependents: Registry[] = [];

  abstract _init(): Promise<any>;

  async initialize() {

    if (this.initialized.run()) {
      return await this.initialized;
    }

    try {
      await this._init();

      this.initialized.resolve(true);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  protected unregister(classes: Class | Class[]) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      if (this.classes.has(cls.__filename!) && this.classes.get(cls.__filename!)!.has(cls.__id!)) {
        this.classes.get(cls.__filename!)!.delete(cls.__id!);
      }
    }
  }

  protected register(classes: Class | Class[]) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (let cls of classes) {
      if (!this.classes.has(cls.__filename!)) {
        this.classes.set(cls.__filename!, new Map());
      }
      let changed = this.classes.get(cls.__filename!)!.has(cls.__id!);
      this.classes.get(cls.__filename!)!.set(cls.__id!, cls);
    }
  }

  protected async watchChanged(file: string, classes: Class[]) {
    let prev = new Map();
    if (this.classes.has(file)) {
      prev = new Map(this.classes.get(file)!.entries());
    }

    await this.unregister(Array.from(prev.values()));
    await this.register(classes);

    let next = this.classes.get(file) || new Map();

    let keys = new Set([...prev.keys(), ...next.keys()]);

    for (let k of keys) {
      if (!next.has(k)) {
        this.emit('removed', prev.get(k)!);
      } else if (!prev.has(k)) {
        this.emit('added', next.get(k));
      } else {
        this.emit('changed', [next.get(k)!, prev.get(k)!]);
      }
    }
  }

  protected emit(event: string, data: Class | Class[]) {
    console.log('Emit', event, data);
    this.events.emit(event, data);
  }

  on(event: 'changed', callback: (result: [Class, Class]) => any): void;
  on(event: 'removed', callback: (result: Class) => any): void;
  on(event: 'added', callback: (result: Class) => any): void;
  on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}