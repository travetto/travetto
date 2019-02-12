import { Class } from '@travetto/registry';
import { ModelRegistry } from './registry';
import { SchemaRegistry } from '@travetto/schema';

import { ModelOptions, IndexConfig } from './types';

export function Model(conf: Partial<ModelOptions<any>> = {}) {
  return function <T extends Class>(target: T) {
    // Force registry first, and update with extra information after computing
    ModelRegistry.register(target, conf);

    const baseModel = ModelRegistry.getBaseModel(target);
    if (baseModel !== target) { // Subtyping if base isn't self
      if (conf.subType) {
        SchemaRegistry.registerSubTypes(target, conf.subType);
      } else {
        conf.subType = SchemaRegistry.getSubTypeName(target);
      }
      conf.collection = ModelRegistry.getBaseCollection(target);
    }
    ModelRegistry.register(target, conf);
    return target;
  };
}

function createIndex<T extends Class>(target: T, config: IndexConfig<T>) {
  ModelRegistry.register(target, { indices: [config] });
  return target;
}

export function Index(config: IndexConfig<any>) {
  return function <T extends Class>(target: T) {
    return createIndex(target, config);
  };
}

/*
export function Unique(...fields: string[]) {
  return function <T extends Class>(target: T) {
    return createIndex(target, { fields, options: { unique: true } });
  };
}
*/
