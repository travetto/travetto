import { SchemaRegistry } from '@travetto/schema';
import { MetadataRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { AppError, castTo, Class, describeFunction, asFull } from '@travetto/runtime';

import { IndexConfig, IndexType, ModelOptions } from './types.ts';
import { NotFoundError } from '../error/not-found.ts';
import { ModelType } from '../types/model.ts';
import { IndexNotSupported } from '../error/invalid-index.ts';

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
  initialModelNameMapping = new Map<string, Class[]>();

  constructor() {
    // Listen to schema and dependency
    super(SchemaRegistry, DependencyRegistry);
  }

  getInitialNameMapping(): Map<string, Class[]> {
    if (this.initialModelNameMapping.size === 0) {
      for (const cls of this.getClasses()) {
        const store = this.get(cls).store ?? cls.name;
        if (!this.initialModelNameMapping.has(store)) {
          this.initialModelNameMapping.set(store, []);
        }
        this.initialModelNameMapping.get(store)!.push(cls);
      }
    }
    return this.initialModelNameMapping;
  }

  createPending(cls: Class): Partial<ModelOptions<ModelType>> {
    return {
      class: cls,
      indices: [],
      autoCreate: true,
      baseType: describeFunction(cls).abstract,
      postLoad: [],
      prePersist: []
    };
  }

  registerDataHandlers(cls: Class, pConfig?: Partial<ModelOptions<ModelType>>): void {
    const cfg = this.getOrCreatePending(cls);
    this.register(cls, {
      ...cfg,
      prePersist: [...cfg.prePersist ?? [], ...pConfig?.prePersist ?? []],
      postLoad: [...cfg.postLoad ?? [], ...pConfig?.postLoad ?? []],
    });
  }

  onInstallFinalize(cls: Class): ModelOptions<ModelType> {
    const config = asFull(this.pending.get(cls.Ⲑid)!);

    const schema = SchemaRegistry.get(cls);
    const view = schema.totalView.schema;
    delete view.id.required; // Allow ids to be optional

    if (schema.subTypeField in view && this.getBaseModel(cls) !== cls) {
      config.subType = !!schema.subTypeName; // Copy from schema
      delete view[schema.subTypeField].required; // Allow type to be optional
    }

    const parent = this.getParentClass(cls);
    if (parent && parent !== cls) {
      const pCfg = this.get(parent) ?? this.pending.get(MetadataRegistry.id(parent));
      config.prePersist = [...pCfg?.prePersist ?? [], ...config.prePersist ?? []];
      config.postLoad = [...pCfg?.postLoad ?? [], ...config.postLoad ?? []];
    }
    return config;
  }

  override onUninstallFinalize(cls: Class): void {
    this.stores.delete(cls);

    // Force system to recompute on uninstall
    this.baseModels.clear();
    this.baseModelGrouped.clear();
  }

  /**
   * Find base class for a given model
   */
  getBaseModel<T extends ModelType>(cls: Class<T>): Class<T> {
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
  getAllClassesByBaseType(): Map<Class, Class[]> {
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
  getClassesByBaseType(base: Class): Class[] {
    return this.getAllClassesByBaseType().get(base) ?? [];
  }

  /**
   * Get the apparent store for a type, handling polymorphism when appropriate
   */
  getStore(cls: Class): string {
    if (!this.stores.has(cls)) {
      const config = this.get(cls) ?? this.getOrCreatePending(cls);
      const base = this.getBaseModel(cls);
      if (base !== cls) {
        return this.getStore(base);
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

      this.stores.set(cls, name);
    }
    return this.stores.get(cls)!;
  }

  /**
   * Get Index
   */
  getIndex<T extends ModelType, K extends IndexType[]>(cls: Class<T>, name: string, supportedTypes?: K): IndexConfig<T> & { type: K[number] } {
    const cfg = this.get(cls).indices?.find((x): x is IndexConfig<T> => x.name === name);
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
    return (this.get(cls).indices ?? []).filter((x): x is IndexConfig<T> => !supportedTypes || supportedTypes.includes(x.type));
  }

  /**
   * Get expiry field
   * @param cls
   */
  getExpiry<T extends ModelType>(cls: Class<T>): keyof T {
    const expiry = this.get(cls).expiresAt;
    if (!expiry) {
      throw new AppError(`${cls.name} is not configured with expiry support, please use @ExpiresAt to declare expiration behavior`);
    }
    return castTo(expiry);
  }
}

export const ModelRegistry = new $ModelRegistry();