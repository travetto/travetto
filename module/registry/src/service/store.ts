import { AppError, castTo, Class, getParentClass } from '@travetto/runtime';

import { EXPIRED_CLASS, RegistrationMethods, RegistryAdapter } from './types';

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
  }

  #resolveClass(cls: Class): Class {
    return (EXPIRED_CLASS in cls) ? this.getClassById(cls.Ⲑid) : cls;
  }

  getClasses(): Class[] {
    return Array.from(this.#adapters.keys());
  }

  has(cls: Class): boolean {
    return this.#adapters.has(this.#resolveClass(cls));
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

  adapter(cls: Class): A {
    cls = this.#resolveClass(cls);
    if (!this.#adapters.has(cls)!) {
      const adapter = new this.#adapterCls(cls);
      this.#adapters.set(cls, adapter);
      this.#idToCls.set(cls.Ⲑid, cls);
    }

    return castTo(this.#adapters.get(cls));
  }

  remove(cls: Class): void {
    this.#adapters.delete(cls);
    this.#finalized.delete(cls);
  }

  getForRegister(cls: Class, allowFinalized = false): A {
    if (this.#finalized.get(cls) && !allowFinalized) {
      throw new AppError(`Class ${cls.Ⲑid} is already finalized`);
    }
    return this.adapter(cls);
  }

  get(cls: Class): Omit<A, RegistrationMethods> {
    cls = this.#resolveClass(cls);
    if (!this.has(cls)) {
      throw new AppError(`Class ${cls.Ⲑid} is not registered for ${this.#adapterCls.Ⲑid}`);
    }
    return this.adapter(cls);
  }

  getOptional(cls: Class): Omit<A, RegistrationMethods> | undefined {
    if (!this.has(cls)) {
      return undefined;
    }
    return this.adapter(cls);
  }

  finalized(cls: Class): boolean {
    cls = this.#resolveClass(cls);
    return this.#finalized.has(cls);
  }
}
