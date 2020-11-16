import { Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';
import { ModelType } from '../types/model';

import { ModelRegistry } from './registry';
import { IndexConfig, ModelOptions } from './types';

/**
 * Model decorator, extends `@Schema`
 *
 * @augments `@trv:schema/Schema`
 */
export function Model(conf: Partial<ModelOptions<any>> = {}) {
  return function <T extends Class<ModelType>>(target: T) {
    // Force registry first, and update with extra information after computing
    ModelRegistry.register(target, conf);

    const baseModel = ModelRegistry.getBaseModel(target);
    if (baseModel !== target) { // Subtyping if base isn't self
      if (conf.subType) {
        SchemaRegistry.registerSubTypes(target, conf.subType);
      } else {
        conf.subType = SchemaRegistry.getSubTypeName(target);
      }
      conf.store = ModelRegistry.getBaseStore(target);
    }
    ModelRegistry.register(target, conf);
    return target;
  };
}


/**
 * Defines an index on a model
 */
export function Index<T extends ModelType>(...indices: IndexConfig<T>[]) {
  return function (target: Class<T>) {
    return ModelRegistry.getOrCreatePending(target).indices!.push(...indices);
  };
}