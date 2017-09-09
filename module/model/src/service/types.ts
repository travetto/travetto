import { SortOptions } from '../model';
import { Class } from '@encore2/registry';


export interface IndexConfig {
  fields: string[] | { [key: string]: number };
  options: {
    unique?: boolean;
  }
}

export class ModelOptions {
  collection: string;
  defaultSort?: SortOptions;
  indicies: IndexConfig[] = [];
  discriminator?: string;
  subtypes?: { [key: string]: Class };
  extra?: object;
}