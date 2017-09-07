import * as path from 'path';
import { EventEmitter } from 'events';

import { bulkRequire, AppEnv, externalPromise, bulkFind } from '@encore2/base';
import { RetargettingHandler, Compiler } from '@encore2/compiler';
import { Class } from '../model/types';

export abstract class Registry {

  files = new Map<string, Map<string, Class>>();
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

  protected async unregisterFile(file: string) {
    if (this.files.has(file)) {
      this.files.delete(file);
    }
  }

  protected async registerFile(file: string, classes: Class[]) {
    for (let top of classes) {
      if (!this.files.has(top.__filename!)) {
        this.files.set(top.__filename!, new Map());
      }
      let changed = this.files.get(top.__filename!)!.has(top.__id!);
      this.files.get(top.__filename!)!.set(top.__id!, top);
    }
  }

  protected async watchChanged(file: string, classes: Class[]) {
    let prev = this.files.get(file) || new Map();
    await this.unregisterFile(file);
    await this.registerFile(file, classes);
    let next = this.files.get(file) || new Map();

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

  protected async watchRemoved(file: string) {
    console.debug('Removed', file);
    if (this.files.has(file)) {
      for (let cls of this.files.get(file)!.values()) {
        this.emit('removed', cls);
      }
    }
    this.unregisterFile(file);
  }

  protected async watchAdded(file: string, classes: Class[]) {
    console.debug('Added', file);
    this.registerFile(file, classes);
    for (let cls of classes) {
      this.emit('added', cls);
    }
  }

  protected emit(event: string, data: Class | Class[]) {
    this.events.emit(event, data);
  }

  on(event: 'changed', callback: (result: [Class, Class]) => any): void;
  on(event: 'removed', callback: (result: Class) => any): void;
  on(event: 'added', callback: (result: Class) => any): void;
  on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}