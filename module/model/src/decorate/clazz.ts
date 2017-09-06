import { Class } from '@encore/schema';
import { ModelRegistry, ModelOptions } from '../service';
import { SortOptions } from '../model';

export function Model(conf: ModelOptions) {
  return function <T extends Class>(target: T) {
    if (conf.discriminator) {
      const parent = Object.getPrototypeOf(target) as Class;

      const parentConfig = ModelRegistry.getOptions(parent);
      ModelRegistry.registerOptions(parent, {
        subtypes: { key: target }
      });
      conf.collection = parentConfig.collection || parent.name;
    }
    ModelRegistry.registerOptions(target, conf);
    ModelRegistry.finalizeClass(target);
    return target;
  };
}