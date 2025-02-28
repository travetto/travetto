import { Any, Class, Primitive } from '@travetto/runtime';

import { MethodValidatorFn, ValidatorFn } from '../validate/types';

export type ClassList = Class | [Class];

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
}

/**
 * Basic structure for a method configuration
 */
export interface SchemaMethodConfig {
  fields: FieldConfig[];
  validators: MethodValidatorFn<unknown[]>[];
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
  views: Record<string, ViewConfig>;
  /**
   * Composite of all views
   */
  allView: ViewConfig;
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
   * Metadata that is related to the schema structure
   */
  metadata?: Record<symbol, unknown>;
  /**
   * Method parameter configs
   */
  methods: Record<string, SchemaMethodConfig>;
}

/**
 * Field configuration
 */
export interface FieldConfig extends DescribableConfig {
  /**
   * Owner class
   */
  owner?: Class;
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
