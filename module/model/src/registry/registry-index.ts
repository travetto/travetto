import { RegistryIndex, RegistryIndexStore, Registry, ChangeEvent } from '@travetto/registry';
import { AppError, castTo, Class } from '@travetto/runtime';
import { SchemaChangeEvent, SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import { IndexConfig, IndexType, ModelConfig } from './types';
import { ModelType } from '../types/model';
import { ModelRegistryAdapter } from './registry-adapter';
import { IndexNotSupported } from '../error/invalid-index';
import { NotFoundError } from '../error/not-found';

type IndexResult<T extends ModelType, K extends IndexType[]> = IndexConfig<T> & { type: K[number] };

export type ModelFieldChange = {
  path: SchemaFieldConfig[];
  modelCls: Class<ModelType>;
  field: SchemaFieldConfig;
  changes: ChangeEvent<SchemaFieldConfig>[];
};

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

  static getModelSubChanges(schemaCls: Class, previousSchemaCls: Class): ModelFieldChange[] {
    return this.#instance.getModelSubChanges(schemaCls, previousSchemaCls);
  }

  /**
   * Default mapping of classes by class name or
   * by requested store name.  This is the state at the
   * start of the application.
   */
  #modelNameMapping = new Map<string, Set<string>>();

  store = new RegistryIndexStore(ModelRegistryAdapter);

  constructor(source: unknown) { Registry.validateConstructor(source); }

  onAdded(cls: Class): void {
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

  onRemoved(cls: Class): void {
    const { store } = this.store.get(cls).get();
    this.#modelNameMapping.get(store)?.delete(cls.Ⲑid);
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
    const config = this.getConfig(cls).indices?.find((idx): idx is IndexConfig<T> => idx.name === name);
    if (!config) {
      throw new NotFoundError(`${cls.name} Index`, `${name}`);
    }
    if (supportedTypes && !supportedTypes.includes(config.type)) {
      throw new IndexNotSupported(cls, config, `${config.type} indices are not supported.`);
    }
    return config;
  }

  /**
   * Get Indices
   */
  getIndices<T extends ModelType, K extends IndexType[]>(cls: Class<T>, supportedTypes?: K): IndexResult<T, K>[] {
    return (this.getConfig(cls).indices ?? []).filter((idx): idx is IndexConfig<T> => !supportedTypes || supportedTypes.includes(idx.type));
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

  getModelSubChanges(schemaCls: Class, previousSchema: Class): ModelFieldChange[] {
    const out: ModelFieldChange[] = [];
    let changeSet: SchemaChangeEvent;

    for (const modelCls of ModelRegistryIndex.getClasses()) {
      SchemaRegistryIndex.visitFields(modelCls, (field, path) => {
        const fieldType = SchemaRegistryIndex.resolveInstanceType(schemaCls, field.type);
        if (fieldType.Ⲑid === schemaCls.Ⲑid) {
          changeSet ??= SchemaRegistryIndex.computeClassChange(
            SchemaRegistryIndex.getConfig(schemaCls),
            SchemaRegistryIndex.getConfig(previousSchema)
          );
          out.push({ path, modelCls, field, changes: changeSet.fieldChanges });
        }
      });
    }
    return out;
  }
}