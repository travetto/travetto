import { Class, ClassInstance } from '@travetto/runtime';
import { ChangeEvent } from '../types';

export type ClassOrId = Class | string | ClassInstance;

export type RegistryIndexClass<C extends RegistryAdapter<{}> = RegistryAdapter<{}>> = {
  new(): RegistryIndex<C>;
};

export type RegistryIndex<A extends RegistryAdapter<{}> = RegistryAdapter<{}>> = {
  process(events: ChangeEvent<Class>[]): void;
  has(clsOrId: ClassOrId): boolean;
  finalize(clsOrId: ClassOrId): void;
  remove(clsOrId: ClassOrId): void;
};

export type RegistrationMethods = `register${string}` | `finalize${string}`;

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}> {
  register(...data: Partial<C>[]): C;
  finalize(parent?: C): void;
  get(): C;
}