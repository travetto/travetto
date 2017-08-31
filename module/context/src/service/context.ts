import { EventEmitter } from 'events';
import { Injectable } from '@encore/di';
import { ContextConfig } from './config';
import { enableLongStacktrace } from './stack';

let cls = require('continuation-local-storage');

export const KEY = 'ctx';

export interface IStorage {
  bindEmitter(item: EventEmitter): any;
  run(fn: () => any): any;
  set(key: string, value: any): void;
  get(key: string): any;
}

@Injectable()
export class Context {
  storage: IStorage;

  constructor(config: ContextConfig) {
    this.storage = cls.createNamespace(config.namespace);
    if (config.longStackTraces) {
      enableLongStacktrace();
    }
  }

  clear() {
    this.storage.set(KEY, null);
  }

  set(c: any) {
    this.storage.set(KEY, c);
  }

  get(): any {
    let res = this.storage.get(KEY) as any;
    if (res === null || res === undefined) {
      this.set(res = {});
    }
    return res;
  }
}