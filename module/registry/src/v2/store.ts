import { AppError, castTo, Class, ClassInstance, getParentClass } from '@travetto/runtime';

import { ClassOrId, RegistrationMethods, RegistryAdapter } from './types';

/**
 * Base registry index implementation
 */
export class RegistryIndexStore<A extends RegistryAdapter<{}> = RegistryAdapter<{}>> {

  // Core data
  #adapters = new Map<Class, A>();
  #idToCls = new Map<string, Class>();
  #adapterCls: new (cls: Class) => A;
  #finalized = new Map<Class, boolean>();

  #toCls(clsOrId: Class | string | ClassInstance): Class {
    if (typeof clsOrId === 'string') {
      const cls = this.#idToCls.get(clsOrId);
      if (!cls) {
        console.trace('Unknown class id', clsOrId);
        throw new AppError(`Unknown class id ${clsOrId}`);
      }
      return cls;
    } else {
      return 'Ⲑid' in clsOrId ? clsOrId : clsOrId.constructor;
    }
  }

  constructor(adapterCls: new (cls: Class) => A) {
    this.#adapterCls = adapterCls;
  }

  getClasses(): Class[] {
    return Array.from(this.#adapters.keys());
  }

  has(cls: Class): boolean {
    return this.#adapters.has(cls);
  }

  finalize(clsOrId: ClassOrId, parentConfig?: ReturnType<A['get']>): void {
    const cls = this.#toCls(clsOrId);
    if (!parentConfig) {
      const parentClass = getParentClass(cls);
      parentConfig = castTo(parentClass && this.has(parentClass) ? this.get(parentClass).get() : undefined);
    }
    this.adapter(cls).finalize(parentConfig);
    this.#finalized.set(cls, true);
  }

  adapter(clsOrId: ClassOrId): A {
    const cls = this.#toCls(clsOrId);
    if (!this.#adapters.has(cls)!) {
      const adapter = new this.#adapterCls(cls);
      this.#adapters.set(cls, adapter);
      this.#idToCls.set(cls.Ⲑid, cls);
    }

    return castTo(this.#adapters.get(cls));
  }

  remove(clsOrId: ClassOrId): void {
    const cls = this.#toCls(clsOrId);
    this.#adapters.delete(cls);
    this.#finalized.delete(cls);
  }

  getForRegister(
    clsOrId: ClassOrId,
    allowFinalized = false
  ): A {
    const cls = this.#toCls(clsOrId);

    if (this.#finalized.get(cls) && !allowFinalized) {
      throw new AppError(`Class ${cls.Ⲑid} is already finalized`);
    }
    return this.adapter(cls);
  }

  get(clsOrId: ClassOrId): Omit<A, RegistrationMethods> {
    if (!this.has(clsOrId)) {
      const cls = this.#toCls(clsOrId);
      throw new AppError(`Class ${cls.Ⲑid} is not registered in index ${this.constructor.Ⲑid}`);
    }
    return this.adapter(clsOrId);
  }

  getOptional(clsOrId: ClassOrId): Omit<A, RegistrationMethods> | undefined {
    if (!this.has(clsOrId)) {
      return undefined;
    }
    return this.adapter(clsOrId);
  }

  finalized(clsOrId: ClassOrId): boolean {
    const cls = this.#toCls(clsOrId);
    return this.#finalized.has(cls);
  }
}
