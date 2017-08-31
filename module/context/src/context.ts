import Config from './config';
import { EventEmitter } from 'events';

let cls = require('continuation-local-storage');

export const KEY = 'ctx';

export interface IStorage {
  bindEmitter(item: EventEmitter): any;
  run(fn: () => any): any;
  set(key: string, value: any): void;
  get(key: string): any;
}

export class Context {
  static storage: IStorage;

  static clear() {
    Context.storage.set(KEY, null);
  }

  static set(c: any) {
    Context.storage.set(KEY, c);
  }

  static get(): any {
    let res = Context.storage.get(KEY) as any;
    if (res === null || res === undefined) {
      Context.set(res = {});
    }
    return res;
  }
}

export function getStorage() {
  return Context.storage;
}

export function initStorage() {
  Context.storage = cls.createNamespace(Config.namespace);
}