let cls = require('continuation-local-storage');
require('./stack');

export const KEY = 'ctx';
export const NAMESPACE = 'encore';

export const Storage = cls.createNamespace(NAMESPACE);

export interface IStorage {
  set(key: string, value: any): void;
  get(key: string): any;
}

export class Context {
  static storage: IStorage = Storage;

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