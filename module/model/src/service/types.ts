import { Class } from '@encore/schema';

export interface IndexConfig {
  fields: string[] | { [key: string]: number };
  //options: mongo.IndexOptions;
}

export interface ModelOptions {
  //defaultSort?: SortOptions;
  indicies: IndexConfig[];
  primaryUnique?: string[];
  discriminator?: string;
  subtypes?: { [key: string]: Class };
}