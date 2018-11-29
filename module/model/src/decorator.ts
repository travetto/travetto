import { Class } from '@travetto/registry';
import { ModelRegistry } from './registry';
import { SchemaRegistry } from '@travetto/schema';

import { ModelOptions, IndexConfig } from './types';

export function Model(conf: Partial<ModelOptions<any>> = {}) {
  return function <T extends Class>(target: T) {
    const parent = Object.getPrototypeOf(target) as Class;
    const parentConfig = ModelRegistry.get(parent);
    if (parentConfig) { // Subtyping
      conf.subtype = true;
      if (conf.discriminator) {
        SchemaRegistry.registerSubtypes(target, conf.discriminator);
      } else {
        conf.discriminator = target.name;
      }
      conf.collection = parentConfig.collection || parent.name;
    }
    ModelRegistry.register(target, conf);
    return target;
  };
}

function createIndex<T extends Class>(target: T, config: IndexConfig<T>) {
  ModelRegistry.register(target, { indicies: [config] });
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
