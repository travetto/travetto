import type { Any, Class, IntrinsicType, NumericLikeIntrinsic, Primitive } from '@travetto/runtime';

import type { MethodValidatorFn, ValidatorFn } from '../validate/types.ts';

type TemplateLiteralPart = string | NumberConstructor | StringConstructor | BooleanConstructor;
export type TemplateLiteral = { operation: 'and' | 'or', values: (TemplateLiteralPart | TemplateLiteral)[] };

export const CONSTRUCTOR_PROPERTY = 'CONSTRUCTOR';

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
   * Is the type a binary type
   */
  binary?: boolean;
  /**
   * The class tied to the type
   */
  type: Class;
  /**
   * Is the field a foreign type
   */
  isForeign?: boolean;
};

/**
 * Basic schema configuration
 */
export interface SchemaCoreConfig {
  /**
   * Schema class
   */
  class: Class;
  /**
   * Description
   */
  description?: string;
  /**
   * List of examples
   */
  examples?: string[];
  /**
   * Is the field/method/private
   */
  private?: boolean;
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
   * Is the method static
   */
  isStatic?: boolean;
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
}

/**
 * Schema configuration
 */
export interface SchemaFieldMap {
  /**
   * List of all fields
   */
  [key: string]: SchemaFieldConfig;
}

/**
 * Class configuration
 */
export interface SchemaClassConfig extends SchemaCoreConfig {
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
   * Is this a base class for discrimination
   */
  discriminatedBase?: boolean;
  /**
   * Do we have a discriminator field
   */
  discriminatedField?: string;
  /**
   * Discriminated type name
   */
  discriminatedType?: string;
  /**
   * Method configs
   */
  methods: Record<string, SchemaMethodConfig>;
  /**
   * Interfaces that the class implements
   */
  interfaces: Class[];
  /**
   * Is this class derived from another via a mapped type
   */
  mappedOperation?: 'Omit' | 'Pick' | 'Partial' | 'Required';
  /**
   * Are there any restrictions in the mapped type
   */
  mappedFields?: string[];
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
  match?: { regex: RegExp, message?: string, template?: TemplateLiteral };
  /**
   * Minimum value configuration
   */
  min?: { limit: NumericLikeIntrinsic, message?: string };
  /**
   * Maximum value configuration
   */
  max?: { limit: NumericLikeIntrinsic, message?: string };
  /**
   * Minimum length configuration
   */
  minlength?: { limit: number, message?: string };
  /**
   * Maximum length configuration
   */
  maxlength?: { limit: number, message?: string };
  /**
   * Enumerated values
   */
  enum?: { values: Primitive[], message: string };
  /**
   * Default value
   */
  default?: IntrinsicType | [];
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
  method: string;
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
  name: string;
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
