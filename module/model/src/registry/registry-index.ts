import { type RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';
import { RuntimeError, castTo, type Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { IndexConfig, ModelConfig } from './types.ts';
import type { ModelType } from '../types/model.ts';
import { ModelRegistryAdapter } from './registry-adapter.ts';

/**
 * Model registry index for managing model configurations across classes
 */
export class ModelRegistryIndex implements RegistryIndex {

  static #instance = Registry.registerIndex(this);

  static getForRegister(cls: Class): ModelRegistryAdapter {
    return this.#instance.store.getForRegister(cls);
  }

  static getConfig(cls: Class): ModelConfig {
    return this.#instance.getConfig(cls);
  }

  static has(cls: Class): boolean {
    return this.#instance.store.has(cls);
  }

  static getStoreName<T extends ModelType>(cls: Class<T>): string {
    return this.#instance.getStoreName(cls);
  }

  static getIndices<T extends ModelType>(cls: Class<T>): IndexConfig[] {
    return this.#instance.getIndices(cls);
  }

  static getExpiryFieldName<T extends ModelType>(cls: Class<T>): keyof T {
    return this.#instance.getExpiryFieldName(cls);
  }

  static getClasses(): Class[] {
    return this.#instance.store.getClasses();
  }

  /**
   * Default mapping of classes by class name or
   * by requested store name.  This is the state at the
   * start of the application.
   */
  #modelNameMapping = new Map<string, Set<string>>();

  store = new RegistryIndexStore(ModelRegistryAdapter);

  /** @private */ constructor(source: unknown) { Registry.validateConstructor(source); }

  onCreate(cls: Class): void {
    const schema = SchemaRegistryIndex.getConfig(cls);

    // Don't index on discriminated schemas
    if (schema.discriminatedType && !schema.discriminatedBase) {
      return;
    }

    const { store } = this.getConfig(cls);
    let classes = this.#modelNameMapping.get(store);
    if (!classes) {
      this.#modelNameMapping.set(store, classes = new Set());
    }
    classes.add(cls.Ⲑid);

    // Don't allow two models with same class name, or same store name
    if (classes.size > 1) {
      throw new RuntimeError('Duplicate models with same store name', {
        details: { classes: [...classes].toSorted() }
      });
    }
  }

  getConfig(cls: Class): ModelConfig<ModelType> {
    return this.store.get(cls).get();
  }

  /**
   * Get the apparent store for a type, handling polymorphism when appropriate
   */
  getStoreName(cls: Class): string {
    return this.store.get(cls).get().store;
  }

  /**
   * Get Indices
   */
  getIndices<T extends ModelType>(cls: Class<T>): IndexConfig[] {
    return Object.values(this.getConfig(cls).indices ?? []);
  }

  /**
   * Get expiry field
   * @param cls
   */
  getExpiryFieldName<T extends ModelType>(cls: Class<T>): keyof T {
    const expiry = this.getConfig(cls).expiresAt;
    if (!expiry) {
      throw new RuntimeError(`${cls.name} is not configured with expiry support, please use @ExpiresAt to declare expiration behavior`);
    }
    return castTo(expiry);
  }
}