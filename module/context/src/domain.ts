// import { Injectable } from '@travetto/di';
import * as domain from 'domain';

export class DomainAsyncContext {
  storageState = new Map<string, any>();

  get id() {
    return process.domain ? (process.domain as any).id || 0 : 0;
  }

  getNewId() {
    return `${Math.trunc(Math.random() * 100000)}.${Date.now()}`;
  }

  storage(val: any): void;
  storage(): any;
  storage(val?: any) {
    const key = this.id;
    if (val) {
      this.storageState.set(key, val);
    } else {
      let obj = this.storageState.get(key);
      if (!obj) {
        obj = {};
        this.storage(obj);
      }
      return obj;
    }
  }

  clear() {
    const obj = this.storage();
    const keys = Object.keys(obj);
    for (const k of keys) {
      delete obj[k];
    }
  }

  get = () => this.storage();
  set = (val: any) => this.storage(val);

  async run(fn: () => Promise<any>, init: any = {}) {
    const d = domain.create();
    const id = this.getNewId();
    (d as any).id = id;

    this.storageState.set(id, init);

    console.trace('My Id', id);

    try {
      return await new Promise((res, rej) => {
        d.run(() => {
          console.trace('My Id2', this.id);
          fn().then(res, rej);
        });
      });
    } finally {
      this.storageState.delete(id);
      d.exit();
    }
  }
}