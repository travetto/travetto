/* eslint @typescript-eslint/no-unused-vars: ["error", { "args": "none", "varsIgnorePattern": "^(_.*|[A-Z])$" } ] */
import { Any, castKey, castTo, classConstruct } from '@travetto/runtime';

const ProxyTargetSymbol = Symbol();

const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () { });
const GeneratorFunction = Object.getPrototypeOf(function* () { });
const AsyncFunction = Object.getPrototypeOf(async function () { });

function isFunction(value: unknown): value is Function {
  const proto = value && Object.getPrototypeOf(value);
  return proto && (proto === Function.prototype || proto === AsyncFunction || proto === AsyncGeneratorFunction || proto === GeneratorFunction);
}

/**
 * Handler for for proxying modules while watching
 */
export class RetargettingHandler<T> implements ProxyHandler<Any> {
  target: T;
  constructor(target: T) { this.target = target; }

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
    return classConstruct(castTo(this.target), argArray);
  }

  setPrototypeOf(target: T, value: unknown): boolean {
    return Object.setPrototypeOf(this.target, castTo(value));
  }

  getPrototypeOf(target: T): object | null {
    return Object.getPrototypeOf(this.target);
  }

  get(target: T, property: PropertyKey, receiver: unknown): Any {
    if (property === ProxyTargetSymbol) {
      return this.target;
    }
    let result = this.target[castKey<T>(property)];
    if (isFunction(result) && !result.Ⲑid && !/^class\s/.test(Function.prototype.toString.call(result))) {
      // Bind class members to class instance instead of proxy propagating
      result = result.bind(this.target);
    }
    return result;
  }

  has(target: T, property: PropertyKey): boolean {
    return castTo<object>(this.target).hasOwnProperty(property);
  }

  set(target: T, property: PropertyKey, value: unknown): boolean {
    this.target[castKey<T>(property)] = castTo(value);
    return true;
  }

  ownKeys(target: T): (string | symbol)[] {
    const keys: (string | symbol)[] = [];
    return keys
      .concat(Object.getOwnPropertyNames(this.target))
      .concat(Object.getOwnPropertySymbols(this.target));
  }

  deleteProperty(target: T, property: PropertyKey): boolean {
    return delete this.target[castKey<T>(property)];
  }

  defineProperty(target: T, property: PropertyKey, attributes: PropertyDescriptor): boolean {
    Object.defineProperty(this.target, property, attributes);
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
  static unwrap<U>(value: U): U {
    return castTo<{ [ProxyTargetSymbol]: U }>(value)?.[ProxyTargetSymbol] ?? value;
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