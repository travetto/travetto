import { Class } from '@travetto/base';
import { Primitive } from '@travetto/base/src/internal/global-types';

import { AllViewⲐ } from '../internal/types';
import { ValidatorFn } from '../validate/types';

export type ClassList = Class | [Class];

/**
 * Basic describable configuration
 */
export interface DescribableConfig {
  /**
   * Title
   */
  title?: string;
  /**
   * Description
   */
  description?: string;
  /**
   * List of examples
   */
  examples?: string[];
}

/**
 * Schema configuration
 */
export interface SchemaConfig {
  /**
   * List of all fields
   */
  [key: string]: FieldConfig;
}

/**
 * Specific view configuration for a schema
 */
export interface ViewConfig {
  /**
   * The schema config
   */
  schema: SchemaConfig;
  /**
   * The list of all fields in the view
   */
  fields: string[];
}

/**
 * Class configuration
 */
export interface ClassConfig extends DescribableConfig {
  /**
   * Target class
   */
  class: Class;
  /**
   * List of all views
   */
  views: Record<string, ViewConfig> & { [AllViewⲐ]: ViewConfig };
  /**
   * Global validators
   */
  validators: ValidatorFn<unknown, unknown>[];
  /**
   * Is the class a sub type
   */
  subType?: boolean;
}

/**
 * Field configuration
 */
export interface FieldConfig extends DescribableConfig {
  /**
   * Owner class
   */
  owner: Class;
  /**
   * Field name
   */
  name: string;
  /**
   * List of aliases
   */
  aliases?: string[];
  /**
   * Specific type for the field, with optional binding/validation support
   */
  type: Class & {
    bindSchema?(input: unknown): undefined | unknown;
    validateSchema?(input: unknown): string | undefined;
  };
  /**
   * View name for validation when dealing with complex types
   */
  view?: string;
  /**
   * The position of the field if ordered
   */
  index?: number;
  /**
   * Is the field an array
   */
  array: boolean;
  /**
   * Does the field have a specialization
   */
  specifier?: string;
  /**
   * The numeric precision
   */
  precision?: [number, number] | [number, undefined];
  /**
   * Is the field required
   */
  required?: { active: boolean, message?: string };
  /**
   * Does the field expect a match
   */
  match?: { re: RegExp, message?: string };
  /**
   * Minimum value configuration
   */
  min?: { n: number | Date, message?: string };
  /**
   * Maximum value configuration
   */
  max?: { n: number | Date, message?: string };
  /**
   * Minimum length configuration
   */
  minlength?: { n: number, message?: string };
  /**
   * Maximum length configuration
   */
  maxlength?: { n: number, message?: string };
  /**
   * Enumerated values
   */
  enum?: { values: (string | number | boolean)[], message: string };
  /**
   * Default value
   */
  default?: Primitive;
  /**
   * Is the field readonly, or write only?, defaults to no restrictions
   */
  access?: 'readonly' | 'writeonly';
}

export type ViewFieldsConfig<T> = { with: (keyof T)[] } | { without: (keyof T)[] };
