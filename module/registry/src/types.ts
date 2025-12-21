import type { Class } from '@travetto/runtime';

export type RegistrationMethods = `register${string}` | `finalize${string}`;

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}> {
  register(...data: Partial<C>[]): C;
  finalize?(parent?: C): void;
  get(): C;
}

export type RegistryIndexClass = {
  new(source: unknown): RegistryIndex;
};

/**
 * Simple store interface for registry indexes
 */
export interface RegistrySimpleStore {
  has(cls: Class): boolean;
  finalize(cls: Class): void;
  finalized(cls: Class): boolean;
  getClasses(): Class[];
};

/**
 * Registry index definition
 * @concrete
 */
export interface RegistryIndex {
  store: RegistrySimpleStore;
  finalize?(cls: Class): void;
  onCreate?(cls: Class): void;
  onChangeSetComplete?(events: Class[]): void;
  beforeChangeSetComplete?(events: Class[]): void;
}