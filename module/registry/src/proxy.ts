import { castTo, clsInstance } from '@travetto/runtime';

const ProxyTargetⲐ = Symbol.for('@travetto/runtime:proxy-target');

const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () { });
const GeneratorFunction = Object.getPrototypeOf(function* () { });
const AsyncFunction = Object.getPrototypeOf(async function () { });

function isFunction(o: unknown): o is Function {
  const proto = o && Object.getPrototypeOf(o);
  return proto && (proto === Function.prototype || proto === AsyncFunction || proto === AsyncGeneratorFunction || proto === GeneratorFunction);
}

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
    return castTo<Function>(this.target).apply(this.target, argArray);
  }

  construct(target: T, argArray: unknown[], newTarget?: unknown): object {
    return clsInstance(castTo(this.target), argArray);
  }

  setPrototypeOf(target: T, v: unknown): boolean {
    return Object.setPrototypeOf(this.target, castTo(v));
  }

  getPrototypeOf(target: T): object | null {
    return Object.getPrototypeOf(this.target);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(target: T, prop: PropertyKey, receiver: unknown): any {
    if (prop === ProxyTargetⲐ) {
      return this.target;
    }
    let ret = this.target[castTo<keyof T>(prop)];
    if (isFunction(ret) && !/^class\s/.test(Function.prototype.toString.call(ret))) {
      // Bind class members to class instance instead of proxy propagating
      ret = ret.bind(this.target);
    }
    return ret;
  }

  has(target: T, prop: PropertyKey): boolean {
    return castTo<object>(this.target).hasOwnProperty(prop);
  }

  set(target: T, prop: PropertyKey, value: unknown): boolean {
    this.target[castTo<keyof T>(prop)] = castTo(value);
    return true;
  }

  ownKeys(target: T): (string | symbol)[] {
    const keys: (string | symbol)[] = [];
    return keys
      .concat(Object.getOwnPropertyNames(this.target))
      .concat(Object.getOwnPropertySymbols(this.target));
  }

  deleteProperty(target: T, p: PropertyKey): boolean {
    return delete this.target[castTo<keyof T>(p)];
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
  static unwrap<U>(el: U & { [ProxyTargetⲐ]?: unknown }): U {
    return castTo(el ? (el[ProxyTargetⲐ] ?? el) : el);
  }

  #handler: RetargettingHandler<T>;
  #instance: Proxy<T>;

  constructor(initial: T) {
    this.#handler = new RetargettingHandler(initial);
    this.#instance = new Proxy({}, castTo(this.#handler));
  }

  setTarget(next: T): void {
    if (next !== this.#handler.target) {
      this.#handler.target = next;
    }
  }

  getTarget(): T {
    return this.#handler.target;
  }

  get<V extends T>(): V {
    return castTo(this.#instance);
  }
}
