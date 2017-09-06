import { Class } from '@encore/schema';
import { SortOptions } from '../model';


export interface IndexConfig {
  fields: string[] | { [key: string]: number };
  options: {
    unique?: boolean;
  }
}

export interface ModelOptions {
  collection?: string;
  defaultSort?: SortOptions;
  indicies?: IndexConfig[];
  discriminator?: string;
  subtypes?: { [key: string]: Class };
  extra?: object;
}