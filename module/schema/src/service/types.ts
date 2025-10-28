import { Any, Class, Primitive } from '@travetto/runtime';

import { MethodValidatorFn, ValidatorFn } from '../validate/types.ts';

type TemplateLiteralPart = string | NumberConstructor | StringConstructor | BooleanConstructor;
export type TemplateLiteral = { op: 'and' | 'or', values: (TemplateLiteralPart | TemplateLiteral)[] };

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
  /**
   * Metadata that is related to the schema structure
   */
  metadata?: Record<symbol, unknown>;
}

/**
 * Basic structure for a method configuration
 */
export interface MethodConfig extends DescribableConfig {
  /**
   * The parameters of the method
   */
  parameters: ParameterConfig[];
  /**
   * Validators to run for th method
   */
  validators: MethodValidatorFn<unknown[]>[];
}

/**
 * Schema configuration
 */
export interface SchemaConfig {
  /**
   * List of all fields
   */
  [key: string | symbol]: FieldConfig;
}

/**
 * View configuration
 */
export type ViewConfig = {
  fields: SchemaConfig;
  names: (string | symbol)[];
};

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
  views: Record<string, ViewFieldsConfig<Any>>;
  /**
   * Field configurations
   */
  fields: SchemaConfig;
  /**
   * Global validators
   */
  validators: ValidatorFn<Any, unknown>[];
  /**
   * Is the class a base type
   */
  baseType?: boolean;
  /**
   * Sub type name
   */
  subTypeName?: string;
  /**
   * The field the subtype is determined by
   */
  subTypeField: string;
  /**
   * Method configs
   */
  methods: Record<string | symbol, MethodConfig>;
}

export interface InputConfig extends DescribableConfig {
  /**
   * Key name for validation when dealing with complex types
   */
  view?: string;
  /**
   * Owner class
   */
  owner: Class;
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
   * Is the field an array
   */
  array?: boolean;
  /**
   * Does the field have a specialization
   */
  specifiers?: string[];
  /**
   * The numeric precision
   */
  precision?: [number, number | undefined];
  /**
   * Is the field required
   */
  required?: { active: boolean, message?: string };
  /**
   * Does the field expect a match
   */
  match?: { re: RegExp, message?: string, template?: TemplateLiteral };
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
  default?: Primitive | [];
}

/**
 * Parameter configuration for methods
 */
export interface ParameterConfig extends InputConfig {
  /**
   * Parameter name
   */
  name?: string | symbol;
  /**
   * The position of the field if ordered
   */
  index: number;
  /**
   * Method the parameter belongs to
   */
  method: string | symbol;
}

/**
 * Field configuration
 */
export interface FieldConfig extends InputConfig {
  /**
   * Field name
   */
  name: string | symbol;
  /**
   * Is the field readonly, or write only?, defaults to no restrictions
   */
  access?: 'readonly' | 'writeonly';
  /**
   * Is this field secret, defaults to no, can be used to hide field when exporting values
   */
  secret?: boolean;
  /**
   * Is this field a getter or setter
   */
  accessor?: string;
}

export type ViewFieldsConfig<T> = { with: Extract<(keyof T), string>[] } | { without: Extract<(keyof T), string>[] };
