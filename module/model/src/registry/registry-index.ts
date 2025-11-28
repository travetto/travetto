import { ChangeEvent, RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';
import { AppError, castTo, Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { IndexConfig, IndexType, ModelConfig } from './types';
import { ModelType } from '../types/model';
import { ModelRegistryAdapter } from './registry-adapter';
import { IndexNotSupported } from '../error/invalid-index';
import { NotFoundError } from '../error/not-found';

type IndexResult<T extends ModelType, K extends IndexType[]> = IndexConfig<T> & { type: K[number] };

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

  static getIndices<T extends ModelType, K extends IndexType[]>(cls: Class<T>, supportedTypes?: K): IndexResult<T, K>[] {
    return this.#instance.getIndices(cls, supportedTypes);
  }

  static getIndex<T extends ModelType, K extends IndexType[]>(cls: Class<T>, name: string, supportedTypes?: K): IndexResult<T, K> {
    return this.#instance.getIndex(cls, name, supportedTypes);
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

  #addClass(cls: Class): void {
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
      throw new AppError('Duplicate models with same store name', {
        details: { classes: [...classes].toSorted() }
      });
    }
  }

  #removeClass(cls: Class): void {
    const { store } = this.store.get(cls).get();
    this.#modelNameMapping.get(store)?.delete(cls.Ⲑid);
  }

  process(events: ChangeEvent<Class>[]): void {
    for (const event of events) {
      if ('prev' in event) {
        this.#removeClass(event.prev);
      }
      if ('curr' in event) {
        this.#addClass(event.curr);
      }
    }
  }

  finalize(cls: Class): void {
    this.store.finalize(cls);
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
   * Get Index
   */
  getIndex<T extends ModelType, K extends IndexType[]>(cls: Class<T>, name: string, supportedTypes?: K): IndexResult<T, K> {
    const cfg = this.getConfig(cls).indices?.find((x): x is IndexConfig<T> => x.name === name);
    if (!cfg) {
      throw new NotFoundError(`${cls.name} Index`, `${name}`);
    }
    if (supportedTypes && !supportedTypes.includes(cfg.type)) {
      throw new IndexNotSupported(cls, cfg, `${cfg.type} indices are not supported.`);
    }
    return cfg;
  }

  /**
   * Get Indices
   */
  getIndices<T extends ModelType, K extends IndexType[]>(cls: Class<T>, supportedTypes?: K): IndexResult<T, K>[] {
    return (this.getConfig(cls).indices ?? []).filter((x): x is IndexConfig<T> => !supportedTypes || supportedTypes.includes(x.type));
  }

  /**
   * Get expiry field
   * @param cls
   */
  getExpiryFieldName<T extends ModelType>(cls: Class<T>): keyof T {
    const expiry = this.getConfig(cls).expiresAt;
    if (!expiry) {
      throw new AppError(`${cls.name} is not configured with expiry support, please use @ExpiresAt to declare expiration behavior`);
    }
    return castTo(expiry);
  }
}