import { Class } from '@travetto/registry';
import { ValidationError } from './validator';

export const DEFAULT_VIEW = '__all';

export type ClassList = Class | [Class];

export type ValidatorFn<T, U> = (value: T, parent?: U) => ValidationError | undefined;

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
  validators: ValidatorFn<any, any>[];
}

export interface FieldConfig {
  type: any;
  name: string;
  aliases?: string[];
  declared: {
    type: Class<any>;
    array: boolean;
    specifier?: string;
    precision?: number
  };
  required?: { message?: string };
  match?: { re: RegExp, message?: string };
  min?: { n: number | Date, message?: string };
  max?: { n: number | Date, message?: string };
  minlength?: { n: number, message?: string };
  maxlength?: { n: number, message?: string };
  enum?: { values: any[], message: string };
}