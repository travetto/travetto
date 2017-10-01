import { SortOptions } from '../model';
import { Class } from '@travetto/registry';


export interface IndexConfig {
  fields: string[] | { [key: string]: number };
  options: {
    unique?: boolean;
  }
}

export class ModelOptions {
  class: Class;
  collection: string;
  defaultSort?: SortOptions;
  indicies: IndexConfig[] = [];
  discriminator?: string;
  subtypes?: { [key: string]: Class };
  extra?: object;
}