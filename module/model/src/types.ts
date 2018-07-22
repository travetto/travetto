import { SortClause } from '@travetto/model/src/model';
import { Class } from '@travetto/registry';

export interface IndexConfig<T> {
  fields: SortClause<T>;
  options: {
    unique?: boolean;
  };
}

export class ModelOptions<T> {
  class: Class<T>;
  collection: string;
  defaultSort?: SortClause<T>[];
  indicies: IndexConfig<T>[] = [];
  discriminator?: string;
  subtypes?: { [key: string]: Class };
  extra?: object;
}