const IS_PROXIED = Symbol.for('@trv:watch/proxy');

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

  apply(target: T, thisArg: any, argArray?: any): any {
    // @ts-expect-error
    return this.target.apply(thisArg, argArray);
  }

  construct(target: T, argArray: any, newTarget?: any) {
    // @ts-expect-error
    return new this.target(...argArray);
  }

  setPrototypeOf(target: T, v: any): boolean {
    return Object.setPrototypeOf(this.target, v);
  }

  getPrototypeOf(target: T): object | null {
    return Object.getPrototypeOf(this.target);
  }

  get(target: T, prop: PropertyKey, receiver: any) {
    // @ts-expect-error
    return this.target[prop];
  }

  has(target: T, prop: PropertyKey) {
    if (prop === IS_PROXIED) {
      return true;
    }
    // @ts-expect-error
    return this.target.hasOwnProperty(prop);
  }

  set(target: T, prop: PropertyKey, value: any) {
    // @ts-expect-error
    this.target[prop] = value;
    return true;
  }

  ownKeys(target: T): PropertyKey[] {
    const keys = ([] as PropertyKey[])
      .concat(Object.getOwnPropertyNames(this.target))
      .concat(Object.getOwnPropertySymbols(this.target));
    return keys;
  }

  deleteProperty(target: T, p: PropertyKey) {
    // @ts-expect-error
    return delete this.target[p];
  }

  defineProperty(target: T, p: PropertyKey, attributes: PropertyDescriptor) {
    return Object.defineProperty(this.target, p, attributes);
  }
}

interface Proxy<T> { }

/**
 * Generate Retargetting Proxy
 */
export class RetargettingProxy<T> {
  static isProxied(o: any): o is RetargettingProxy<any> {
    return o && IS_PROXIED in o;
  }

  private handler: RetargettingHandler<T>;
  private instance: Proxy<T>;
  constructor(initial: T) {
    this.handler = new RetargettingHandler(initial);
    this.instance = new Proxy({}, this.handler);
  }
  setTarget(next: T) {
    this.handler.target = next;
  }

  getTarget(): T {
    return this.handler.target;
  }

  get(): T {
    return this.instance as T;
  }
}
