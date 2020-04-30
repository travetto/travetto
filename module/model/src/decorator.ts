import { Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';

import { ModelRegistry } from './registry';
import { ModelOptions, IndexConfig } from './types';

/** @augments trv/schema/Schema */
// TODO: Document
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

// TODO: Document
export function Index(...indices: IndexConfig<any>[]) {
  return function <T extends Class>(target: T) {
    return ModelRegistry.register(target, { indices });
  };
}
