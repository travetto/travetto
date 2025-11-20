import { Class, ClassInstance } from '@travetto/runtime';
import { ChangeEvent } from '../types';

export type ClassOrId = Class | string | ClassInstance;


export type RegistrationMethods = `register${string}` | `finalize${string}`;

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}> {
  register(...data: Partial<C>[]): C;
  finalize(parent?: C): void;
  get(): C;
}

export type RegistryIndexClass = {
  new(): RegistryIndex;
};

/**
 * Registry index definition
 */
export type RegistryIndex = {
  store: {
    has(clsOrId: ClassOrId): boolean;
    finalize(clsOrId: ClassOrId): void;
    remove(clsOrId: ClassOrId): void;
  };
  process(events: ChangeEvent<Class>[]): void;
};