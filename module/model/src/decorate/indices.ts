import { Class } from '@encore/schema';
import { ModelRegistry, IndexConfig } from '../service';

function createIndex<T extends Class>(target: T, config: IndexConfig) {
  ModelRegistry.registerOptions(target, { indicies: [config] });
  return target;
}

export function Index(config: IndexConfig) {
  return function <T extends Class>(target: T) {
    return createIndex(target, config);
  };
}

export function Unique(...fields: string[]) {
  return function <T extends Class>(target: T) {
    return createIndex(target, { fields, options: { unique: true } });
  };
}