import { Class, ClassInstance } from '@travetto/runtime';

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