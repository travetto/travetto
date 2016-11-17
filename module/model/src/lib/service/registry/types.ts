import * as mongoose from "mongoose";
import { Named, SortOptions } from '@encore/mongo';

export interface ModelCls<T> extends Named {
  new (conf?: any): T;
}

export interface Cls {
  new (...args: any[]): any;
  name: string;
}

export type ClsLst = Cls | [Cls];

export interface IndexConfig {
  fields: string[];
  unique?: boolean;
  sparse?: boolean;
}

export interface ModelConfig {
  collection?: string;
  schemaOpts?: mongoose.SchemaOptions;
  fields: string[];
  schema: { [key: string]: any };
  discriminator?: string;
  discriminated?: { [key: string]: ModelCls<any> };
  defaultSort?: SortOptions;
  indices: IndexConfig[]
}

export interface FieldCfg {
  required?: boolean;
  unique?: boolean;
  enum?: any[];

  type: ClsLst;
}
