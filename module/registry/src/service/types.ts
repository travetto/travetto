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
export interface RegistryChangeListener<T> {
  beforeChangeSetComplete?(events: ChangeEvent<T>[]): void;
  onRemoved?(cls: T, replacedBy?: T): void;
  onAdded?(cls: T, previous?: T): void;
  onChangeSetComplete?(events: ChangeEvent<T>[]): void;
}

/**
 * Registry index definition
 * @concrete
 */
export interface RegistryIndex extends RegistryChangeListener<Class> {
  store: RegistrySimpleStore;
  finalize?(cls: Class): void;
}