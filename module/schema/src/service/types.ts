import { Any, Class, Primitive, TypedFunction } from '@travetto/runtime';

import { MethodValidatorFn, ValidatorFn } from '../validate/types.ts';

type TemplateLiteralPart = string | NumberConstructor | StringConstructor | BooleanConstructor;
export type TemplateLiteral = { op: 'and' | 'or', values: (TemplateLiteralPart | TemplateLiteral)[] };

/**
 * Represents a typed item in the schema
 */
export type SchemaBasicType = {
  /**
   * Description of the type
   */
  description?: string;
  /**
   * Is the type an array
   */
  array?: boolean;
  /**
   * The class tied to the type
   */
  type: Class & {
    bindSchema?(input: unknown): undefined | unknown;
    validateSchema?(input: unknown): string | undefined;
  };
  /**
   * The foreign type for the field, if applicable
   */
  foreignType?: Class;
};

/**
 * Basic schema configuration
 */
export interface SchemaCoreConfig {
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
export interface SchemaMethodConfig extends SchemaCoreConfig {
  /**
   * The parameters of the method
   */
  parameters: SchemaParameterConfig[];
  /**
   * Validators to run for th method
   */
  validators: MethodValidatorFn<unknown[]>[];
  /**
   * The return type configuration
   */
  returnType?: SchemaBasicType;
  /**
   * The method handle
   */
  handle: TypedFunction<Any, unknown>;
}

/**
 * Schema configuration
 */
export interface SchemaFieldMap {
  /**
   * List of all fields
   */
  [key: string | symbol]: SchemaFieldConfig;
}

/**
 * Class configuration
 */
export interface SchemaClassConfig extends SchemaCoreConfig {
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
  fields: SchemaFieldMap;
  /**
   * Global validators
   */
  validators: ValidatorFn<Any, unknown>[];
  /**
   * Is the class a base type
   */
  baseType?: boolean;
  /**
   * Is the class a sub type
   */
  subType?: boolean;
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
  methods: Record<string | symbol, SchemaMethodConfig>;
  /**
   * Interfaces that the class implements
   */
  interfaces: Class[];
}

/**
 * Shared base type for all input-related fields
 */
export interface SchemaInputConfig extends SchemaCoreConfig, SchemaBasicType {
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
export interface SchemaParameterConfig extends SchemaInputConfig {
  /**
   * Parameter name
   */
  name?: string;
  /**
   * The position of the field if ordered
   */
  index: number;
  /**
   * Method the parameter belongs to
   */
  method: string | symbol;
  /**
   * Source text for the parameter
   */
  sourceText?: string;
}

/**
 * Field configuration
 */
export interface SchemaFieldConfig extends SchemaInputConfig {
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
