import { Class } from '@travetto/registry';

import { ModelRegistry } from '@travetto/model-core';
import { SortClause } from '../model/query';


/**
 * Index options
 */
export interface IndexConfig<T> {
  /**
   * Fields and sort order
   */
  fields: SortClause<T>[];
  /**
   * Extra config
   */
  options?: {
    unique?: boolean;
  };
}

/**
 * Defines an index on a model
 */
export function Index(...indices: IndexConfig<any>[]) {
  return function <T extends Class>(target: T) {
    return ModelRegistry.register(target, { extra: { indices } });
  };
}
