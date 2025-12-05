import { Class } from '@travetto/runtime';

export type RegistrationMethods = `register${string}` | `finalize${string}`;

export const EXPIRED_CLASS = Symbol();

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}> {
  register(...data: Partial<C>[]): C;
  finalize?(parent?: C): void;
  get(): C;
}

export type RegistryIndexClass = {
  new(): RegistryIndex;
};

/**
 * Simple store interface for registry indexes
 */
export interface RegistrySimpleStore {
  has(cls: Class): boolean;
  finalize(cls: Class): void;
  finalized(cls: Class): boolean;
  remove(cls: Class): void;
  getClasses(): Class[];
};

/**
 * Registry index definition
 * @concrete
 */
export interface RegistryIndex {
  store: RegistrySimpleStore;
  onChangeSetComplete?(): void;
  onRemoved?(cls: Class, replacedBy?: Class): void;
  onAdded?(cls: Class, previous?: Class): void;
  finalize?(cls: Class): void;
}