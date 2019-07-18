import { Class } from '@travetto/registry';
import { ValidatorFn } from '../validate/types';

export const ALL_VIEW = '__all';

export type ClassList = Class | [Class];

export interface DescribableConfig {
  title?: string;
  description?: string;
  examples?: string[];
}

export interface SchemaConfig {
  [key: string]: FieldConfig;
}
export interface ViewConfig {
  schema: SchemaConfig;
  fields: string[];
}

export interface ClassConfig extends DescribableConfig {
  class: Class;
  views: Record<string, ViewConfig>;
  validators: ValidatorFn<any, any>[];
}

export interface FieldConfig extends DescribableConfig {
  owner: Class<any>;
  name: string;
  aliases?: string[];
  type: Class<any>;
  array: boolean;
  specifier?: string;
  precision?: [number, number] | [number, undefined];
  required?: { active: boolean, message?: string };
  match?: { re: RegExp, message?: string };
  min?: { n: number | Date, message?: string };
  max?: { n: number | Date, message?: string };
  minlength?: { n: number, message?: string };
  maxlength?: { n: number, message?: string };
  enum?: { values: any[], message: string };
}

export type ViewFieldsConfig<T> = { with: (keyof T)[] } | { without: (keyof T)[] };
