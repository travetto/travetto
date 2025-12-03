import { Any, AppError, castTo, Class, getParentClass, Runtime } from '@travetto/runtime';

import { EXPIRED_CLASS, RegistrationMethods, RegistryAdapter } from './types';

function ExchangeExpired<R = unknown>() {
  return function (
    target: Any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(this: RegistryIndexStore, cls: Class) => R>
  ): void {
    if (Runtime.dynamic) {
      const original = descriptor.value!;
      descriptor.value = function (this: RegistryIndexStore, cls: Class): R {
        const resolved = EXPIRED_CLASS in cls ? this.getClassById(cls.Ⲑid) : cls;
        return original.apply(this, [resolved]);
      };
    }
  };
}

/**
 * Base registry index implementation
 */
export class RegistryIndexStore<A extends RegistryAdapter<{}> = RegistryAdapter<{}>> {

  // Core data
  #adapters = new Map<Class, A>();
  #idToCls = new Map<string, Class>();
  #adapterCls: new (cls: Class) => A;
  #finalized = new Map<Class, boolean>();

  constructor(adapterCls: new (cls: Class) => A) {
    this.#adapterCls = adapterCls;
    this.getClassById = this.getClassById.bind(this);
  }

  getClasses(): Class[] {
    return Array.from(this.#adapters.keys());
  }

  getClassById(id: string): Class {
    return this.#idToCls.get(id)!;
  }

  finalize(cls: Class, parentConfig?: ReturnType<A['get']>): void {
    if (!parentConfig) {
      const parentClass = getParentClass(cls);
      parentConfig = castTo(parentClass && this.has(parentClass) ? this.get(parentClass).get() : undefined);
    }
    this.adapter(cls).finalize?.(parentConfig);
    this.#finalized.set(cls, true);
  }

  remove(cls: Class): void {
    this.#adapters.delete(cls);
    this.#finalized.delete(cls);
  }

  @ExchangeExpired()
  has(cls: Class): boolean {
    return this.#adapters.has(cls);
  }

  @ExchangeExpired()
  adapter(cls: Class): A {
    if (!this.#adapters.has(cls)!) {
      const adapter = new this.#adapterCls(cls);
      this.#adapters.set(cls, adapter);
      this.#idToCls.set(cls.Ⲑid, cls);
    }

    return castTo(this.#adapters.get(cls));
  }

  @ExchangeExpired()
  getForRegister(cls: Class, allowFinalized = false): A {
    if (this.#finalized.get(cls) && !allowFinalized) {
      throw new AppError(`Class ${cls.Ⲑid} is already finalized`);
    }
    return this.adapter(cls);
  }

  @ExchangeExpired()
  get(cls: Class): Omit<A, RegistrationMethods> {
    if (!this.has(cls)) {
      throw new AppError(`Class ${cls.Ⲑid} is not registered for ${this.#adapterCls.Ⲑid}`);
    }
    return this.adapter(cls);
  }

  @ExchangeExpired()
  getOptional(cls: Class): Omit<A, RegistrationMethods> | undefined {
    if (!this.has(cls)) {
      return undefined;
    }
    return this.adapter(cls);
  }

  @ExchangeExpired()
  finalized(cls: Class): boolean {
    return this.#finalized.has(cls);
  }
}
