import * as mongoose from 'mongoose';
import * as mongo from 'mongodb';
import { Named, SortOptions } from '@encore/mongo';

export interface ModelCls<T> extends Named {
  new (conf?: any): T;
}

export interface Cls<T> {
  new (...args: any[]): T;
  name: string;
}

export type ClsList = Cls<any> | [Cls<any>];

export interface IndexConfig {
  fields: string[] | { [key: string]: number };
  options: mongo.IndexOptions;
}

export interface ModelConfig {
  collection?: string;
  schemaOpts?: mongoose.SchemaOptions;
  views: {
    [key: string]: {
      schema: { [key: string]: FieldCfg },
      fields: string[]
    }
  };
  discriminator?: string;
  discriminated?: { [key: string]: ModelCls<any> };
  defaultSort?: SortOptions;
  indices: IndexConfig[];
  primaryUnique?: string[];
}

export interface FieldCfg {
  required?: boolean;
  unique?: boolean;
  enum?: any[];
  type: any;
  declared: { type: Cls<any>, array: boolean };
}