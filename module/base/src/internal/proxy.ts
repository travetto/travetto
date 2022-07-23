import { ConcreteClass } from '../types';
import { Util } from '../util';

const ProxyTargetⲐ = Symbol.for('@trv:base/proxy-target');

/**
 * Handler for for proxying modules while watching
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class RetargettingHandler<T> implements ProxyHandler<any> {
  constructor(public target: T) { }

  isExtensible(target: T): boolean {
    return !Object.isFrozen(this.target);
  }

  getOwnPropertyDescriptor(target: T, property: PropertyKey): PropertyDescriptor | undefined {
    if (property === '__esModule') {
      return undefined;
    } else {
      return Object.getOwnPropertyDescriptor(this.target, property);
    }
  }

  preventExtensions(target: T): boolean {
    return !!Object.preventExtensions(this.target);
  }

  apply(target: T, thisArg: T, argArray?: unknown[]): unknown {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (this.target as unknown as Function).apply(this.target, argArray);
  }

  construct(target: T, argArray: unknown[], newTarget?: unknown): object {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return new (this.target as unknown as ConcreteClass)(...argArray);
  }

  setPrototypeOf(target: T, v: unknown): boolean {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Object.setPrototypeOf(this.target, v as Record<string, unknown>);
  }

  getPrototypeOf(target: T): object | null {
    return Object.getPrototypeOf(this.target);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(target: T, prop: PropertyKey, receiver: unknown): any {
    if (prop === ProxyTargetⲐ) {
      return this.target;
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    let ret = this.target[prop as keyof T];
    if (Util.isFunction(ret) && !/^class\s/.test(Function.prototype.toString.call(ret))) {
      // Bind class members to class instance instead of proxy propagating
      ret = ret.bind(this.target);
    }
    return ret;
  }

  has(target: T, prop: PropertyKey): boolean {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (this.target as Object).hasOwnProperty(prop);
  }

  set(target: T, prop: PropertyKey, value: unknown): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    this.target[prop as keyof T] = value as any;
    return true;
  }

  ownKeys(target: T): (string | symbol)[] {
    const keys: (string | symbol)[] = [];
    return keys
      .concat(Object.getOwnPropertyNames(this.target))
      .concat(Object.getOwnPropertySymbols(this.target));
  }

  deleteProperty(target: T, p: PropertyKey): boolean {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return delete this.target[p as keyof T];
  }

  defineProperty(target: T, p: PropertyKey, attributes: PropertyDescriptor): boolean {
    Object.defineProperty(this.target, p, attributes);
    return true;
  }
}

interface Proxy<T> { }

/**
 * Generate Retargetting Proxy
 */
export class RetargettingProxy<T> {

  /**
   * Unwrap proxy
   */
  static unwrap<U>(el: U): U {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    return (el ? ((el as any)[ProxyTargetⲐ] ?? el) : el) as U;
  }

  #handler: RetargettingHandler<T>;
  #instance: Proxy<T>;

  constructor(initial: T) {
    this.#handler = new RetargettingHandler(initial);
    this.#instance = new Proxy({}, this.#handler);
  }

  setTarget(next: T): void {
    if (next !== this.#handler.target) {
      this.#handler.target = next;
    }
  }

  getTarget(): T {
    return this.#handler.target;
  }

  get(): T {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.#instance as T;
  }
}
