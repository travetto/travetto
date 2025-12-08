import { Class } from '@travetto/runtime';
import { ChangeEvent } from '../types';

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
  new(source: unknown): RegistryIndex;
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
 * Listens for registry changes
 */
export interface RegistryChangeListener {
  beforeChangeSetComplete?(events: ChangeEvent<Class>[]): void;
  onDelete?(cls: Class, replacedBy?: Class): void;
  onCreate?(cls: Class, previous?: Class): void;
  onChangeSetComplete?(events: ChangeEvent<Class>[]): void;
}

/**
 * Registry index definition
 * @concrete
 */
export interface RegistryIndex extends RegistryChangeListener {
  store: RegistrySimpleStore;
  finalize?(cls: Class): void;
}