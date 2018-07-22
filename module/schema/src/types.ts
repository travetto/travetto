import { Class } from '@travetto/registry';
import { ValidationError } from '@travetto/schema/src/service/validator';

export const DEFAULT_VIEW = '__all';

export type ClassList = Class | [Class];

export type ValidatorFn<T, U> = (value: T, parent?: U) => ValidationError | undefined;

export interface DescriableConfig {
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

export interface ClassConfig extends DescriableConfig {
  class: Class;
  views: { [key: string]: ViewConfig };
  validators: ValidatorFn<any, any>[];
}

export interface FieldConfig extends DescriableConfig {
  owner: any;
  name: string;
  aliases?: string[];
  type: Class<any>;
  array: boolean;
  specifier?: string;
  precision?: number;
  required?: { active: boolean, message?: string };
  match?: { re: RegExp, message?: string };
  min?: { n: number | Date, message?: string };
  max?: { n: number | Date, message?: string };
  minlength?: { n: number, message?: string };
  maxlength?: { n: number, message?: string };
  enum?: { values: any[], message: string };
}