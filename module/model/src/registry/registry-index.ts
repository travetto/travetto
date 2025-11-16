import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2 } from '@travetto/registry';
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
export class ModelRegistryIndex implements RegistryIndex<ModelConfig> {

  static { RegistryV2.registerIndex(ModelRegistryIndex); }

  static adapterCls = ModelRegistryAdapter;

  static getForRegister(clsOrId: ClassOrId): ModelRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static getConfig(clsOrId: ClassOrId): ModelConfig {
    return RegistryV2.get(this, clsOrId).get();
  }

  static has(clsOrId: ClassOrId): boolean {
    return RegistryV2.has(this, clsOrId);
  }

  static getStoreName<T extends ModelType>(cls: Class<T>): string {
    return RegistryV2.instance(this).getStoreName(cls);
  }

  static getIndices<T extends ModelType, K extends IndexType[]>(cls: Class<T>, supportedTypes?: K): IndexResult<T, K>[] {
    return RegistryV2.instance(this).getIndices(cls, supportedTypes);
  }

  static getIndex<T extends ModelType, K extends IndexType[]>(cls: Class<T>, name: string, supportedTypes?: K): IndexResult<T, K> {
    return RegistryV2.instance(this).getIndex(cls, name, supportedTypes);
  }

  static getExpiryFieldName<T extends ModelType>(cls: Class<T>): keyof T {
    return RegistryV2.instance(this).getExpiryFieldName(cls);
  }

  /**
   * All stores names
   */
  #stores = new Map<Class, string>();
  /**
   * Default mapping of classes by class name or
   * by requested store name.  This is the state at the
   * start of the application.
   */
  #initialModelNameMapping = new Map<string, Class[]>();

  process(events: ChangeEvent<Class>[]): void {
    for (const event of events) {
      if ('prev' in event) {
        this.#stores.delete(event.prev);
      }
    }
  }

  getInitialNameMapping(): Map<string, Class[]> {
    if (this.#initialModelNameMapping.size === 0) {
      for (const cls of RegistryV2.getClasses(ModelRegistryIndex)) {
        const store = this.getModelOptions(cls).store ?? cls.name;
        if (!this.#initialModelNameMapping.has(store)) {
          this.#initialModelNameMapping.set(store, []);
        }
        this.#initialModelNameMapping.get(store)!.push(cls);
      }
    }
    return this.#initialModelNameMapping;
  }

  getModelOptions(cls: ClassOrId): ModelConfig<ModelType> {
    return RegistryV2.get(ModelRegistryIndex, cls).get();
  }

  has(cls: ClassOrId): boolean {
    return ModelRegistryIndex.has(cls);
  }

  /**
   * Get the apparent store for a type, handling polymorphism when appropriate
   */
  getStoreName(cls: Class): string {
    if (!this.#stores.has(cls)) {
      const config = this.getModelOptions(cls);
      const base = SchemaRegistryIndex.getBaseSchemaClass(cls);
      if (base !== cls) {
        return this.getStoreName(base);
      }

      const name = config.store ?? cls.name.toLowerCase();

      const candidates = this.getInitialNameMapping().get(name) || [];

      // Don't allow two models with same class name, or same store name
      if (candidates.length > 1) {
        if (config.store) {
          throw new AppError('Duplicate models with same store name', {
            details: { classes: candidates.map(x => x.Ⲑid) }
          });
        } else {
          throw new AppError('Duplicate models with same class name, but no store name provided', {
            details: { classes: candidates.map(x => x.Ⲑid) }
          });
        }
      }

      this.#stores.set(cls, name);
    }
    return this.#stores.get(cls)!;
  }

  /**
   * Get Index
   */
  getIndex<T extends ModelType, K extends IndexType[]>(cls: Class<T>, name: string, supportedTypes?: K): IndexResult<T, K> {
    const cfg = this.getModelOptions(cls).indices?.find((x): x is IndexConfig<T> => x.name === name);
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
    return (this.getModelOptions(cls).indices ?? []).filter((x): x is IndexConfig<T> => !supportedTypes || supportedTypes.includes(x.type));
  }

  /**
   * Get expiry field
   * @param cls
   */
  getExpiryFieldName<T extends ModelType>(cls: Class<T>): keyof T {
    const expiry = this.getModelOptions(cls).expiresAt;
    if (!expiry) {
      throw new AppError(`${cls.name} is not configured with expiry support, please use @ExpiresAt to declare expiration behavior`);
    }
    return castTo(expiry);
  }
}