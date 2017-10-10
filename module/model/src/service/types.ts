import { SortClause } from '../model';
import { Class } from '@travetto/registry';


export interface IndexConfig<T> {
  fields: SortClause<T>;
  options: {
    unique?: boolean;
  }
}

export class ModelOptions {
  class: Class;
  collection: string;
  defaultSort?: SortClause<any>;
  indicies: IndexConfig<any>[] = [];
  discriminator?: string;
  subtypes?: { [key: string]: Class };
  extra?: object;
}