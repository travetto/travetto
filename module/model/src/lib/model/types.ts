import * as mongoose from "mongoose";
import { Named } from '@encore/mongo';

export interface ModelCls<T> {
  new (conf?: any): T;
  name: string;
  collection?: string;
  discriminatorKey?: string;
  discriminiators?: { [key: string]: ModelCls<T> }
  defaultSort?: string[] | string
  schemaOpts?: mongoose.SchemaOptions;
  unique?: string[][];
  schema?: any;
}

export interface Cls {
  new (...args: any[]): any;
  name?: string;
}

export type ClsLst = Cls | [Cls]
export interface FieldCfg {
  required?: boolean;
  unique?: boolean;
  enum?: any[];
  type: ClsLst;
}
