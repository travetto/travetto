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

export type RegistryProcessEvent = { cls: Class, replaced?: boolean };

/**
 * Registry index definition
 * @concrete
 */
export interface RegistryIndex {
  store: RegistrySimpleStore;
  onRemove?(events: RegistryProcessEvent[]): void;
  onChange?(events: ChangeEvent<Class>[]): void;
  onAdd?(events: RegistryProcessEvent[]): void;
  finalize?(cls: Class): void;
}