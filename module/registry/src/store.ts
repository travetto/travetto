import { RuntimeError, castTo, type Class, getParentClass } from '@travetto/runtime';

import type { RegistrationMethods, RegistryAdapter, RegistrySimpleStore } from './types.ts';

/**
 * Base registry index implementation
 */
export class RegistryIndexStore<A extends RegistryAdapter<{}> = RegistryAdapter<{}>> implements RegistrySimpleStore {

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

  has(cls: Class): boolean {
    return this.#adapters.has(cls);
  }

  adapter(cls: Class): A {
    if (!this.#adapters.has(cls)!) {
      const adapter = new this.#adapterCls(cls);
      this.#adapters.set(cls, adapter);
      this.#idToCls.set(cls.Ⲑid, cls);
    }

    return castTo(this.#adapters.get(cls));
  }

  getForRegister(cls: Class, allowFinalized = false): A {
    if (this.#finalized.get(cls) && !allowFinalized) {
      throw new RuntimeError(`Class ${cls.Ⲑid} is already finalized`);
    }
    return this.adapter(cls);
  }

  get(cls: Class): Omit<A, RegistrationMethods> {
    if (!this.has(cls)) {
      throw new RuntimeError(`Class ${cls.Ⲑid} is not registered for ${this.#adapterCls.Ⲑid}`);
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
    return this.#finalized.has(cls);
  }
}
