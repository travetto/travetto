import { SchemaRegistry } from '@travetto/schema';
import { MetadataRegistry, Class } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';

import { ModelOptions } from './types';

/**
 * Registry for all models, built on the Metadata registry
 */
class $ModelRegistry extends MetadataRegistry<ModelOptions<any>> {
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

  constructor() {
    // Listen to schema and dependency
    super(SchemaRegistry, DependencyRegistry);
  }

  createPending(cls: Class): Partial<ModelOptions<any>> {
    return { class: cls };
  }

  onInstallFinalize<T>(cls: Class<T>) {
    return this.pending.get(cls.ᚕid)! as ModelOptions<T>;
  }

  onUninstallFinalize(cls: Class) {
    this.stores.delete(cls);

    // Force system to recompute on uninstall
    this.baseModels.clear();
    this.baseModelGrouped.clear();
  }

  /**
   * Find base class for a given model
   */
  getBaseModel(cls: Class) {
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
   * Find the base store for a type
   */
  getBaseStore(cls: Class) {
    return this.getStore(this.getBaseModel(cls));
  }

  /**
   * Get the apparent store for a type
   */
  getStore(cls: Class) {
    if (!this.stores.has(cls)) {
      const config = this.get(cls) ?? this.getOrCreatePending(cls);
      this.stores.set(cls, (config.collection || cls.name).toLowerCase());
    }
    return this.stores.get(cls)!;
  }
}

export const ModelRegistry = new $ModelRegistry();