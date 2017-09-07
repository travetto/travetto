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
        let files = await bulkFind(glob, undefined, (p: string) => !Compiler.optionalFiles.test(p) && !Compiler.definitionFiles.test(p));
        for (let file of files) {
          this.loadFile(file);
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

    if (AppEnv.watch) {
      this.watch();
    }
  }

  private static async unloadFile(file: string) {
    if (this.files.has(file)) {
      this.files.delete(file);
    }
  }

  private static async loadFile(file: string) {
    let out = require(file);

    for (let top of Object.values(out)) {
      if (top.__file) {
        if (!this.files.has(top.__file)) {
          this.files.set(top.__file, new Map());
        }
        let changed = this.files.get(top.__file)!.has(top.__id);
        this.files.get(top.__file)!.set(top.__id, top);
      }
    }
  }

  private static async watchChanged(file: string) {
    let prev = this.files.get(file)!;
    await this.unloadFile(file);
    await this.loadFile(file);
    let next = this.files.get(file)!;

    let keys = new Set([...prev.keys(), ...next.keys()]);

    for (let k of prev.keys()) {
      if (!next.has(k)) {
        this.events.emit('removed', prev.get(k)!);
        keys.delete(k);
      }
    }
    for (let k of next.keys()) {
      if (!prev.has(k)) {
        this.events.emit('added', next.get(k));
        keys.delete(k);
      }
    }
    for (let k of keys) {
      this.events.emit('changed', [next.get(k)!, prev.get(k)!]);
    }
  }

  private static async watchRemoved(file: string) {
    if (this.files.has(file)) {
      for (let cls of this.files.get(file)!.values()) {
        this.events.emit('removed', cls);
      }
    }
    this.unloadFile(file);
  }

  private static async watchAdded(file: string) {
    this.loadFile(file);
    for (let cls of this.files.get(file)!.values()) {
      this.events.emit('added', top);
    }
  }

  private static watch() {
    Compiler.on('changed', this.watchChanged.bind(this));
    Compiler.on('removed', this.watchRemoved.bind(this));
    Compiler.on('added', this.watchAdded.bind(this));
  }

  static on(event: 'changed', callback: (result: [Class, Class]) => any): void;
  static on(event: 'removed', callback: (result: Class) => any): void;
  static on(event: 'added', callback: (result: Class) => any): void;
  static on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}