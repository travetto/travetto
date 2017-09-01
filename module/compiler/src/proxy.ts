export class RetargettingHandler<T extends any> implements ProxyHandler<T> {
  constructor(public target: T) { }


  isExtensible?(target: T): boolean {
    return Object.isFrozen(this.target);
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
    return this.target.apply(thisArg, argArray);
  }
  construct(target: T, argArray: any, newTarget?: any) {
    return new this.target(...argArray);
  }

  setPrototypeOf(target: T, v: any): boolean {
    return Object.setPrototypeOf(this.target, v);
  }

  getPrototypeOf(target: T): object | null {
    return Object.getPrototypeOf(this.target);
  }

  get(target: T, prop: PropertyKey, receiver: any) {
    return this.target[prop];
  }

  has(target: T, prop: PropertyKey) {
    return this.target.hasOwnProperty(prop);
  }

  set(target: T, prop: PropertyKey, value: any) {
    return this.target[prop] = value;
  }

  ownKeys(target: T): PropertyKey[] {
    let keys = ([] as PropertyKey[])
      .concat(Object.getOwnPropertyNames(this.target))
      .concat(Object.getOwnPropertySymbols(this.target));
    return keys;
  }

  deleteProperty(target: T, p: PropertyKey) {
    return delete this.target[p];
  }

  defineProperty(target: T, p: PropertyKey, attributes: PropertyDescriptor) {
    return Object.defineProperty(this.target, p, attributes);
  }
}