import { Class } from '@encore/schema';
import { ModelRegistry, ModelOptions, SortOptions } from '../service';

export function DefaultSort(sort: SortOptions) {
  return function <T extends Class>(target: T) {
    return ModelRegistry.registerOptions(target, {
      defaultSort: sort
    });
  };
}

export function Subtype(key: string) {
  return function <T extends Class>(target: T) {
    const parent = Object.getPrototypeOf(target) as Class;

    const parentConfig = ModelRegistry.getOptions(parent);

    ModelRegistry.registerOptions(target, {
      collection: parentConfig.collection || parent.name,
      discriminator: key
    });

    ModelRegistry.registerOptions(parent, {
      subtypes: {
        key: target
      }
    });

    return target;
  };
}

export function Collection(collection: string) {
  return function <T extends Class>(target: T) {
    ModelRegistry.registerOptions(target, { collection });
    return target;
  };
}