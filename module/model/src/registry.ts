import { SchemaRegistry } from '@travetto/schema';
import { MetadataRegistry, Class } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';

import { ModelOptions } from './types';

export class $ModelRegistry extends MetadataRegistry<ModelOptions<any>> {
  collections = new Map<Class, string>();
  baseModels = new Map<Class, Class>();

  constructor() {
    super(SchemaRegistry, DependencyRegistry);
  }

  createPending(cls: Class) {
    return { class: cls, root: cls };
  }

  onInstallFinalize<T>(cls: Class<T>) {
    return this.pending.get(cls.__id)! as ModelOptions<T>;
  }

  onUninstallFinalize(cls: Class) {
    this.collections.delete(cls);
    this.baseModels.delete(cls);
  }

  getBaseModel(cls: Class) {
    if (!this.baseModels.has(cls)) {
      let conf = this.get(cls) || this.getOrCreatePending(cls);
      let parent = cls;
      while (conf) {
        parent = this.getParentClass(parent)!;
        conf = this.get(parent) || this.pending.get(MetadataRegistry.id(parent));
        if (conf && conf.baseType) {
          this.baseModels.set(cls, parent);
          break;
        }
      }
      if (!conf) {
        this.baseModels.set(cls, cls);
      }
    }
    return this.baseModels.get(cls)!;
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