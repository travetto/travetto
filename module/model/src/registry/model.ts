import { SchemaRegistry } from '@travetto/schema';
import { MetadataRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { AppError, Class } from '@travetto/base';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';

import { IndexConfig, IndexType, ModelOptions } from './types';
import { NotFoundError } from '../error/not-found';
import { ModelType } from '../types/model';
import { IndexNotSupported } from '../error/invalid-index';

/**
 * Registry for all models, built on the Metadata registry
 */
class $ModelRegistry extends MetadataRegistry<ModelOptions<ModelType>> {
  /**
   * All stores names
   */
  stores = new Map<Class, string>();
  /**
   * All base model classes (inherited from)
   */
  baseModels = new Map<Class, Class>();
  /**
   * Indexed base model classes to all subclasses
   */
  baseModelGrouped = new Map<Class, Class[]>();
  /**
   * Default mapping of classes by class name or
   * by requested store name.  This is the state at the
   * start of the application.
   */
  intialModelNameMapping = new Map<string, Class[]>();

  constructor() {
    // Listen to schema and dependency
    super(SchemaRegistry, DependencyRegistry);
  }

  getInitialNameMapping() {
    if (this.intialModelNameMapping.size === 0) {
      for (const cls of this.getClasses()) {
        const store = this.get(cls).store ?? cls.name;
        if (!this.intialModelNameMapping.has(store)) {
          this.intialModelNameMapping.set(store, []);
        }
        this.intialModelNameMapping.get(store)!.push(cls);
      }
    }
    return this.intialModelNameMapping;
  }

  createPending(cls: Class): Partial<ModelOptions<ModelType>> {
    return { class: cls, indices: [], autoCreate: true, baseType: cls.ᚕabstract };
  }

  onInstallFinalize(cls: Class) {
    const config = this.pending.get(cls.ᚕid)! as ModelOptions<ModelType>;

    const schema = SchemaRegistry.get(cls);
    const view = schema.views[AllViewⲐ].schema;
    delete view.id.required; // Allow ids to be optional

    if ('type' in view && this.getBaseModel(cls) !== cls) {
      config.subType = schema.subType; // Copy from schema
      delete view.type.required; // Allow type to be optional
    }
    return config;
  }

  override onUninstallFinalize(cls: Class) {
    this.stores.delete(cls);

    // Force system to recompute on uninstall
    this.baseModels.clear();
    this.baseModelGrouped.clear();
  }

  /**
   * Find base class for a given model
   */
  getBaseModel(cls: Class): Class<ModelType> {
    if (!this.baseModels.has(cls)) {
      let conf = this.get(cls) ?? this.getOrCreatePending(cls);
      let parent = cls;

      while (conf && !conf.baseType) {
        parent = this.getParentClass(parent)!;
        conf = this.get(parent) ?? this.pending.get(MetadataRegistry.id(parent));
      }

      this.baseModels.set(cls, conf ? parent : cls);
    }
    return this.baseModels.get(cls)!;
  }

  /**
   * Find all classes by their base types
   */
  getAllClassesByBaseType() {
    if (!this.baseModelGrouped.size) {
      const out = new Map<Class, Class[]>();
      for (const el of this.entries.keys()) {
        const conf = this.entries.get(el)!;
        if (conf.baseType) {
          continue;
        }

        const parent = this.getBaseModel(conf.class);

        if (!out.has(parent)) {
          out.set(parent, []);
        }

        out.get(parent)!.push(conf.class);
      }
      this.baseModelGrouped = out;
    }
    return this.baseModelGrouped;
  }

  /**
   * Get all classes for a given base type
   */
  getClassesByBaseType(base: Class) {
    return this.getAllClassesByBaseType().get(base) ?? [];
  }

  /**
   * Get the apparent store for a type, handling polymorphism when appropriate
   */
  getStore(cls: Class): string {
    if (!this.stores.has(cls)) {
      const config = this.get(cls) ?? this.getOrCreatePending(cls);
      if (config.subType) {
        return this.getStore(this.getBaseModel(cls));
      }

      const name = config.store ?? cls.name.toLowerCase();

      const candidates = this.getInitialNameMapping().get(name) || [];

      // Don't allow two models with same class name, or same store name
      if (candidates.length > 1) {
        if (config.store) {
          throw new AppError('Duplicate models with same store name', 'general', {
            classes: candidates.map(x => x.ᚕid)
          });
        } else {
          throw new AppError('Duplicate models with same class name, but no store name provided', 'general', {
            classes: candidates.map(x => x.ᚕid)
          });
        }
      }

      this.stores.set(cls, name);
    }
    return this.stores.get(cls)!;
  }

  /**
   * Get Index
   */
  getIndex<T extends ModelType, K extends IndexType[]>(cls: Class<T>, name: string, supportedTypes?: K): IndexConfig<T> & { type: K[number] } {
    const cfg = this.get(cls).indices?.find(x => x.name === name) as IndexConfig<T>;
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
  getIndices<T extends ModelType, K extends IndexType[]>(cls: Class<T>, supportedTypes?: K): (IndexConfig<T> & { type: K[number] })[] {
    return (this.get(cls).indices ?? []).filter(x => !supportedTypes || supportedTypes.includes(x.type)) as IndexConfig<T>[];
  }

  /**
   * Get expiry field
   * @param cls
   */
  getExpiry(cls: Class) {
    const expiry = this.get(cls).expiresAt;
    if (!expiry) {
      throw new AppError(`${cls.name} is not configured with expiry support, please use @ExpiresAt to declare expiration behavior`, 'general');
    }
    return expiry;
  }
}

export const ModelRegistry = new $ModelRegistry();