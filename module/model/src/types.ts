import { Class } from '@travetto/registry';

import { SortClause } from './model/query';

// TODO: Document
export interface IndexConfig<T> {
  fields: SortClause<T>[];
  options?: {
    unique?: boolean;
  };
}

// TODO: Document
export class ModelOptions<T> {
  class: Class<T>;
  collection?: string;
  defaultSort?: SortClause<T>[];
  indices: IndexConfig<T>[] = [];
  subType?: string;
  baseType?: boolean;
  extra?: object;
}