import { Class } from '@travetto/registry';
import { ModelRegistry, ModelOptions } from '../service';
import { SortOptions } from '../model';

export function Model(conf: Partial<ModelOptions> = {}) {
  return function <T extends Class>(target: T) {
    if (conf.discriminator) {
      const parent = Object.getPrototypeOf(target) as Class;

      const parentConfig = ModelRegistry.get(parent);
      ModelRegistry.register(parent, {
        subtypes: { key: target }
      });
      conf.collection = parentConfig.collection || parent.name;
    }
    ModelRegistry.register(target, conf);
    return target;
  };
}