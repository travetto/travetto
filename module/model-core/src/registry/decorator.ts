import { Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';
import { ModelType } from '../types/model';

import { ModelRegistry } from './registry';
import { ModelOptions } from './types';

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
      conf.collection = ModelRegistry.getBaseStore(target);
    }
    ModelRegistry.register(target, conf);
    return target;
  };
}