import { Class } from '@travetto/registry';

export interface SchemaClass<T = any> {
  from?: <Z>(data: any) => Z;
}

export type ClassList = Class | [Class];

export interface SchemaConfig {
  [key: string]: FieldConfig;
}
export interface ViewConfig {
  schema: SchemaConfig;
  fields: string[];
}

export interface ClassConfig {
  class: Class;
  views: { [key: string]: ViewConfig };
}

export interface FieldConfig {
  type: any;
  name: string;
  aliases?: string[];
  declared: { type: Class<any>, array: boolean };
  required?: { message?: string };
  match?: { re: RegExp, message?: string };
  min?: { n: number | Date, message?: string };
  max?: { n: number | Date, message?: string };
  minlength?: { n: number, message?: string };
  maxlength?: { n: number, message?: string };
  enum?: { values: any[], message: string };
}