import { ConcreteClass, Util } from '@travetto/base';

const IsProxiedSym = Symbol.for('@trv:watch/proxy');

/**
 * Handler for for proxying modules while watching
 */
export class RetargettingHandler<T> implements ProxyHandler<any> {
  constructor(public target: T) { }

  isExtensible(target: T): boolean {
    return !Object.isFrozen(this.target);
  }

  getOwnPropertyDescriptor(target: T, property: PropertyKey) {
    if (property === '__esModule') {
      return undefined;
    } else {
      return Object.getOwnPropertyDescriptor(this.target, property);
    }
  }

  preventExtensions(target: T): boolean {
    return !!Object.preventExtensions(this.target);
  }

  apply(target: T, thisArg: T, argArray?: any): any {
    return (this.target as unknown as Function).apply(this.target, argArray);
  }

  construct(target: T, argArray: any[], newTarget?: any) {
    return new (this.target as unknown as ConcreteClass)(...argArray);
  }

  setPrototypeOf(target: T, v: any): boolean {
    return Object.setPrototypeOf(this.target, v);
  }

  getPrototypeOf(target: T): object | null {
    return Object.getPrototypeOf(this.target);
  }

  get(target: T, prop: PropertyKey, receiver: any) {
    let ret = this.target[prop as keyof T];
    if (Util.isFunction(ret) && !/^class\s/.test(Function.prototype.toString.call(ret))) {
      // Bind class members to class instance instead of proxy propagating
      ret = ret.bind(this.target);
    }
    return ret;
  }

  has(target: T, prop: PropertyKey) {
    if (prop === IsProxiedSym) {
      return true;
    }
    return (this.target as Object).hasOwnProperty(prop);
  }

  set(target: T, prop: PropertyKey, value: any) {
    this.target[prop as keyof T] = value;
    return true;
  }

  ownKeys(target: T): (string | symbol)[] {
    const keys = ([] as (string | symbol)[])
      .concat(Object.getOwnPropertyNames(this.target))
      .concat(Object.getOwnPropertySymbols(this.target));
    return keys;
  }

  deleteProperty(target: T, p: PropertyKey) {
    return delete this.target[p as keyof T];
  }

  defineProperty(target: T, p: PropertyKey, attributes: PropertyDescriptor) {
    Object.defineProperty(this.target, p, attributes);
    return true;
  }
}

interface Proxy<T> { }

/**
 * Generate Retargetting Proxy
 */
export class RetargettingProxy<T> {
  static isProxied(o: unknown): o is RetargettingProxy<unknown> {
    return !!o && IsProxiedSym in (o as object);
  }

  #handler: RetargettingHandler<T>;
  #instance: Proxy<T>;

  constructor(initial: T) {
    this.#handler = new RetargettingHandler(initial);
    this.#instance = new Proxy({}, this.#handler);
  }
  setTarget(next: T) {
    this.#handler.target = next;
  }

  getTarget(): T {
    return this.#handler.target;
  }

  get(): T {
    return this.#instance as T;
  }
}
