import { Class, ClassInstance } from '@travetto/runtime';
import { ChangeEvent } from '../types';

export type ClassOrId = Class | string | ClassInstance;

export type RegistryIndexClass<C extends {} = {}> = {
  adapterCls: new (cls: Class) => RegistryAdapter<C>;
  new(): RegistryIndex<C>;
};

export type RegistrationMethods = `register${string}` | `finalize${string}`;

export interface RegistryIndex<C extends {} = {}> {
  init?(): Promise<void> | void;
  process(events: ChangeEvent<Class>[]): void;
  getParentClass?(cls: Class): Class | undefined;
}

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}> {
  indexCls: RegistryIndexClass<C>;
  register(...data: Partial<C>[]): C;
  finalize(parent?: C): void;
  get(): C;
}