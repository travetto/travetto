import { SchemaRegistry } from '@travetto/schema';
import { MetadataRegistry, Class } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';

import { ModelOptions } from './types';

export class $ModelRegistry extends MetadataRegistry<ModelOptions<any>> {
  collections = new Map<Class, string>();
  baseModels = new Map<Class, Class>();
  baseModelGrouped = new Map<Class, Class[]>();

  constructor() {
    super(SchemaRegistry, DependencyRegistry);
  }

  createPending(cls: Class): Partial<ModelOptions<any>> {
    return { class: cls, indices: [] };
  }

  onInstallFinalize<T>(cls: Class<T>) {
    return this.pending.get(cls.__id)! as ModelOptions<T>;
  }

  onUninstallFinalize(cls: Class) {
    this.collections.delete(cls);

    // Need to recompute
    this.baseModels.clear();
    this.baseModelGrouped.clear();
  }

  getBaseModel(cls: Class) {
    if (!this.baseModels.has(cls)) {
      let conf = this.get(cls) || this.getOrCreatePending(cls);
      let parent = cls;

      while (conf && !conf.baseType) {
        parent = this.getParentClass(parent)!;
        conf = this.get(parent) || this.pending.get(MetadataRegistry.id(parent));
      }

      this.baseModels.set(cls, conf ? parent : cls);
    }
    return this.baseModels.get(cls)!;
  }

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

  getClassesByBaseType(base: Class) {
    return this.getAllClassesByBaseType().get(base)! || [];
  }

  getBaseCollection(cls: Class) {
    return this.getCollectionName(this.getBaseModel(cls));
  }

  getCollectionName(cls: Class) {
    if (!this.collections.has(cls)) {
      const config = this.get(cls) || this.getOrCreatePending(cls);
      this.collections.set(cls, (config.collection || cls.name).toLowerCase());
    }
    return this.collections.get(cls)!;
  }
}

export const ModelRegistry = new $ModelRegistry();