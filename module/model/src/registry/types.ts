import { Class } from '@travetto/registry';

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
 * Model options
 */
export class ModelOptions<T> {
  /**
   * Class for model
   */
  class: Class<T>;
  /**
   * Colleciton name
   */
  collection?: string;
  /**
   * Default sort for a given model
   */
  defaultSort?: SortClause<T>[];
  /**
   * List of all indices
   */
  indices: IndexConfig<T>[] = [];
  /**
   * If a sub type, identifier type
   */
  subType?: string;
  /**
   * Is a base type?
   */
  baseType?: boolean;
  /**
   * Vendor specific extras
   */
  extra?: object;
}