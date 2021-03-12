import { Class } from '@travetto/base';
import { SchemaRegistry } from '@travetto/schema';

import { ModelType } from '../types/model';
import { ModelRegistry } from './model';
import { IndexConfig, ModelOptions } from './types';

/**
 * Model decorator, extends `@Schema`
 *
 * @augments `@trv:schema/Schema`
 */
export function Model(conf: Partial<ModelOptions<ModelType>> | string = {}) {
  return function <T extends ModelType, U extends Class<T>>(target: U): U {
    if (typeof conf === 'string') {
      conf = { store: conf };
    }

    // Force registry first, and update with extra information after computing
    ModelRegistry.register(target, conf);

    const baseModel = ModelRegistry.getBaseModel(target);
    if (baseModel !== target) { // Subtyping if base isn't self
      if (conf.subType) {
        SchemaRegistry.registerSubTypes(target, conf.subType);
      } else {
        conf.subType = SchemaRegistry.getSubTypeName(target);
      }
    }
    ModelRegistry.register(target, conf);
    return target;
  };
}

/**
 * Defines an index on a model
 */
export function Index<T>(...indices: IndexConfig<any>[]) {
  return function (target: Class<T>) {
    ModelRegistry.getOrCreatePending(target).indices!.push(...indices);
  };
}

/**
 * Model field decorator for denoting expiry date/time
 * @augments `@trv:schema/Field`
 */
export function ExpiresAt() {
  return <K extends string, T extends Partial<Record<K, Date>>>(tgt: T, prop: K) => {
    ModelRegistry.register(tgt.constructor as Class<T>, { expiresAt: prop });
  };
}