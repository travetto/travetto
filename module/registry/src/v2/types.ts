import { AppError, castTo, Class, ClassInstance } from '@travetto/runtime';
import { ChangeEvent } from '../types';

export type ClassOrId = Class | string | ClassInstance;

export type RegistryIndexClass<C extends {} = {}> = {
  new(): RegistryIndex<C>;
};

export type RegistrationMethods = `register${string}` | `finalize${string}`;

export interface RegistryIndex<C extends {}> {
  process(events: ChangeEvent<Class>[]): void;
  adapter(cls: Class): RegistryAdapter<C>;
}

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {}> {
  indexCls: RegistryIndexClass<C>;
  register(...data: Partial<C>[]): C;
  finalize(parent?: C): void;
  get(): C;
}

/**
 * Represents a registered item in the registry.
 */
export class RegistryItem {
  cls: Class;
  finalized: boolean = false;
  adapters = new Map<RegistryIndex<{}>, RegistryAdapter<{}>>();

  constructor(cls: Class) {
    this.cls = cls;
  }

  readonlyAdapter<C extends {} = {}>(
    index: RegistryIndex<C>,
    cls: Class,
  ): RegistryAdapter<C> {
    const value = this.adapters.get(index);
    if (!value) {
      throw new AppError(`Class ${cls} is not registered in index ${index.constructor.name}`);
    }
    if (!this.finalized) {
      throw new AppError(`Class ${cls} is not accessible until finalized in index ${index.constructor.name}`);
    }
    return castTo(value);
  }

  adapter<C extends {} = {}>(
    index: RegistryIndex<C>,
    cls: Class,
  ): RegistryAdapter<C> {
    if (!this.adapters.has(index)) {
      const adapter = index.adapter(cls);
      adapter.indexCls = castTo(index.constructor);
      this.adapters.set(index, adapter);
    }
    return castTo(this.adapters.get(index)!);
  }

  finalize(): void {
    for (const adapter of this.adapters.values()) {
      adapter.finalize();
    }
    this.finalized = true;
  }
}
