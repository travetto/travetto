import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2 } from '@travetto/registry';
import { AppError, castTo, Class, getParentClass } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { IndexConfig, IndexType, ModelOptions } from './types';
import { ModelType } from '../types/model';
import { ModelRegistryAdapter } from './registry-adapter';
import { IndexNotSupported } from '../error/invalid-index';
import { NotFoundError } from '../error/not-found';

type ClassType = ModelOptions<ModelType>;

type IndexResult<T extends ModelType, K extends IndexType[]> = IndexConfig<T> & { type: K[number] };

/**
 * Model registry index for managing model configurations across classes
 */
export class ModelRegistryIndex implements RegistryIndex<ModelOptions<ModelType>> {

  static getForRegister(clsOrId: ClassOrId): ModelRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static getModelOptions(clsOrId: ClassOrId): ClassType {
    return RegistryV2.get(this, clsOrId).get();
  }

  static has(clsOrId: ClassOrId): boolean {
    return RegistryV2.has(this, clsOrId);
  }

  static getStoreName<T extends ModelType>(cls: Class<T>): string {
    return RegistryV2.instance(this).getStoreName(cls);
  }

  static getBaseModelClass<T extends ModelType>(cls: Class<T>): Class<T> {
    return RegistryV2.instance(this).getBaseModelClass(cls);
  }

  static getIndices<T extends ModelType, K extends IndexType[]>(cls: Class<T>, supportedTypes?: K): (IndexConfig<T> & { type: K[number] })[] {
    return RegistryV2.instance(this).getIndices(cls, supportedTypes);
  }

  static getIndex<T extends ModelType, K extends IndexType[]>(cls: Class<T>, name: string, supportedTypes?: K): IndexConfig<T> & { type: K[number] } {
    return RegistryV2.instance(this).getIndex(cls, name, supportedTypes);
  }

  static getClassesByBaseType<T extends ModelType>(cls: Class<T>): Class<T>[] {
    const baseType = RegistryV2.instance(this).getBaseModelClass(cls);
    return RegistryV2.instance(this).getClassesByBaseType(baseType);
  }

  static getExpiryFieldName<T extends ModelType>(cls: Class<T>): keyof T {
    return RegistryV2.instance(this).getExpiryFieldName(cls);
  }

  /**
   * All stores names
   */
  #stores = new Map<Class, string>();
  /**
   * All base model classes (inherited from)
   */
  #baseModels = new Map<Class, Class>();
  /**
   * Indexed base model classes to all subclasses
   */
  #baseModelGrouped = new Map<Class, Class[]>();
  /**
   * Default mapping of classes by class name or
   * by requested store name.  This is the state at the
   * start of the application.
   */
  #initialModelNameMapping = new Map<string, Class[]>();

  #finalize(cls: Class): ModelOptions<ModelType> {
    const parent = getParentClass(cls);
    const parentConfig = parent ? this.getModelOptions(parent) : undefined;
    this.adapter(cls).finalize(parentConfig);

    // Finalize
    const schema = SchemaRegistryIndex.getForRegister(cls).get();
    const view = schema.fields;
    delete view.id.required; // Allow ids to be optional

    if (schema.subTypeField in view && this.getBaseModelClass(cls) !== cls) {
      this.getModelOptions(cls).subType = !!schema.subTypeName; // Copy from schema
      delete view[schema.subTypeField].required; // Allow type to be optional
    }

    return this.getModelOptions(cls);
  }

  #clear(): void {
    // Force system to recompute on uninstall
    this.#baseModels.clear();
    this.#baseModelGrouped.clear();
  }

  process(events: ChangeEvent<Class>[]): void {
    for (const event of events) {
      if ('prev' in event) {
        this.#stores.delete(event.prev);
      }
      if ('curr' in event) {
        this.#finalize(event.curr);
      }
    }
    this.#clear();
  }

  adapter(cls: Class): ModelRegistryAdapter {
    return new ModelRegistryAdapter(cls);
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

  getModelOptions(cls: ClassOrId): ModelOptions<ModelType> {
    return RegistryV2.get(ModelRegistryIndex, cls).get();
  }

  has(cls: ClassOrId): boolean {
    return ModelRegistryIndex.has(cls);
  }

  /**
   * Find base class for a given model
   */
  getBaseModelClass<T extends ModelType>(cls: Class<T>): Class<T> {
    if (!this.#baseModels.has(cls)) {
      let conf = this.getModelOptions(cls);
      let parent = cls;

      while (conf && !conf.baseType) {
        parent = getParentClass(parent)!;
        conf = this.getModelOptions(parent);
      }

      this.#baseModels.set(cls, conf ? parent : cls);
    }
    return this.#baseModels.get(cls)!;
  }

  /**
   * Find all classes by their base types
   */
  getAllClassesByBaseType(): Map<Class, Class[]> {
    if (!this.#baseModelGrouped.size) {
      const out = new Map<Class, Class[]>();
      for (const cls of RegistryV2.getClasses(ModelRegistryIndex)) {
        const conf = this.getModelOptions(cls);
        if (conf.baseType) {
          continue;
        }

        const parent = this.getBaseModelClass(conf.class);

        if (!out.has(parent)) {
          out.set(parent, []);
        }

        out.get(parent)!.push(conf.class);
      }
      this.#baseModelGrouped = out;
    }
    return this.#baseModelGrouped;
  }

  /**
   * Get all classes for a given base type
   */
  getClassesByBaseType(base: Class): Class[] {
    return this.getAllClassesByBaseType().get(base) ?? [];
  }

  /**
   * Get the apparent store for a type, handling polymorphism when appropriate
   */
  getStoreName(cls: Class): string {
    if (!this.#stores.has(cls)) {
      const config = this.getModelOptions(cls);
      const base = this.getBaseModelClass(cls);
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
  getIndices<T extends ModelType, K extends IndexType[]>(cls: Class<T>, supportedTypes?: K): (IndexResult<T, K>)[] {
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