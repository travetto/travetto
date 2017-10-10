import { Class } from '@travetto/registry';
import { ModelRegistry, IndexConfig } from '../service';

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