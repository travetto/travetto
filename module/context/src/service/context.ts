import { EventEmitter } from 'events';
import { Injectable } from '@encore2/di';
import { ContextConfig } from './config';

const cls = require('cls-hooked');

export const KEY = 'ctx';

export interface Namespace {
  bindEmitter(item: EventEmitter): any;
  run(fn: () => any): any;
  set(key: string, value: any): void;
  get(key: string): any;
}

@Injectable()
export class Context {
  namespace: Namespace;

  constructor(config: ContextConfig) {
    this.namespace = cls.createNamespace(config.namespace);
  }

  clear() {
    this.namespace.set(KEY, null);
  }

  set(c: any) {
    this.namespace.set(KEY, c);
  }

  get(): any {
    let res = this.namespace.get(KEY) as any;
    if (res === null || res === undefined) {
      this.set(res = {});
    }
    return res;
  }
}