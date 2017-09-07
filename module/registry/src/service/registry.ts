import * as path from 'path';
import { EventEmitter } from 'events';

import { bulkRequire, AppEnv, externalPromise, bulkFind } from '@encore2/base';
import { RetargettingHandler, Compiler } from '@encore2/compiler';
import { Class } from '../model/types';

export class Registry {

  static files = new Map<string, Map<string, Class>>();
  static events = new EventEmitter();
  static initialized = externalPromise();
  static dependants = [];

  static async initialize() {

    if (this.initialized.run()) {
      return await this.initialized;
    }

    try {
      // Do not include dev files for feare of triggering tests
      let globs = (process.env.SCAN_GLOBS || `${Compiler.frameworkWorkingSet} ${Compiler.prodWorkingSet}`).split(/\s+/);
      for (let glob of globs) {
        let files = await bulkFind(glob, undefined, (p: string) =>
          !Compiler.optionalFiles.test(p) &&
          !Compiler.definitionFiles.test(p) &&
          !p.endsWith('index.ts'));
        for (let file of files) {
          if (!this.files.has(file)) {
            this.loadFile(file);
          }
        }
      }

      // Process dependants first
      let i = 0;
      while (i < this.dependants.length) {
        await this.dependants[i];
        i++;
      }

      this.initialized.resolve(true);
    } catch (e) {
      console.log(e);
      throw e;
    }

    // Will only fire in watch mode
    Compiler.on('changed', this.watchChanged.bind(this));
    Compiler.on('removed', this.watchRemoved.bind(this));
    Compiler.on('added', this.watchAdded.bind(this));
  }

  private static async unloadFile(file: string) {
    if (this.files.has(file)) {
      this.files.delete(file);
    }
  }

  private static async loadFile(file: string) {
    let out = require(file);

    for (let top of Object.values(out)) {
      if (top.__id) {
        if (!this.files.has(top.__filename)) {
          this.files.set(top.__filename, new Map());
        }
        let changed = this.files.get(top.__filename)!.has(top.__id);
        this.files.get(top.__filename)!.set(top.__id, top);
      }
    }
  }

  private static async watchChanged(file: string) {
    console.debug('Changed', file);

    let prev = this.files.get(file) || new Map();
    await this.unloadFile(file);
    await this.loadFile(file);
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

  private static async watchRemoved(file: string) {
    console.debug('Removed', file);
    if (this.files.has(file)) {
      for (let cls of this.files.get(file)!.values()) {
        this.emit('removed', cls);
      }
    }
    this.unloadFile(file);
  }

  private static async watchAdded(file: string) {
    console.debug('Added', file);
    this.loadFile(file);
    for (let cls of this.files.get(file)!.values()) {
      this.emit('added', cls);
    }
  }

  private static emit(event: string, data: Class | Class[]) {
    this.events.emit(event, data);
  }

  static on(event: 'changed', callback: (result: [Class, Class]) => any): void;
  static on(event: 'removed', callback: (result: Class) => any): void;
  static on(event: 'added', callback: (result: Class) => any): void;
  static on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}