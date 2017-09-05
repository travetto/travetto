import { Class } from '@encore/schema';

export interface SortOptions {
  fields: [string, boolean][];
}

export interface IndexConfig {
  fields: string[] | { [key: string]: number };
  extra?: object;
}

export interface ModelOptions {
  defaultSort?: SortOptions;
  indicies: IndexConfig[];
  primaryUnique?: string[];
  discriminator?: string;
  subtypes?: { [key: string]: Class };
  extra?: object;
}