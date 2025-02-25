import type ts from 'typescript';
import { TemplateLiteral } from '../types/shared';

/**
 * Base type for a simplistic type structure
 */
export interface Type<K extends string> {
  /**
   * Unique key
   */
  key: K;
  /**
   * Name of type, if nominal, otherwise we will generate a unique identifier
   */
  name?: string;
  /**
   * JS Doc comment
   */
  comment?: string;
  /**
   * Can be undefined
   */
  undefinable?: boolean;
  /**
   * Can be null
   */
  nullable?: boolean;
  /**
   * Original type
   */
  original?: ts.Type;
}

/**
 * A type that is not defined in the scope of the given file, but is importable from the project
 */
export interface ManagedType extends Type<'managed'> {
  /**
   *  Location the type came from, for class references
   */
  importName: string;
  /**
   * Type arguments
   */
  typeArguments?: AnyType[];
  /**
   * Type Info
   */
  tsTypeArguments?: ts.Type[];
}

/**
 * A type that is defined structurally (like an interface)
 */
export interface ShapeType extends Type<'shape'> {
  /**
   *  Location the type came from, for class references
   */
  importName: string;
  /**
   * Does not include methods, used for shapes not concrete types
   */
  fieldTypes: Record<string, AnyType>;

  /**
   * Type Info
   */
  tsFieldTypes?: Record<string, ts.Type>;

  /**
   * Type arguments
   */
  typeArguments?: AnyType[];

  /**
   * Type Arguments
   */
  tsTypeArguments?: ts.Type[];
}

/**
 * A literal type, with an optional real value
 */
export interface LiteralType extends Type<'literal'> {
  /**
   * Pointer to real type (String/Date/Number) if applicable
   */
  ctor: Function | undefined;
  /**
   * Applicable real value
   */
  value?: boolean | string | number | RegExp | Date;
  /**
   * Type arguments
   */
  typeArguments?: AnyType[];
  /**
   * Type Info
   */
  tsTypeArguments?: ts.Type[];
}

/**
 * A literal template type
 */
export interface TemplateType extends Type<'template'> {
  /**
   * Pointer to real type (String)
   */
  ctor: Function;
  /**
   * Type arguments
   */
  template?: TemplateLiteral;
}

/**
 * Union type
 */
export interface CompositionType extends Type<'composition'> {
  /**
   * A common type if derivable, e.g. 'a'|'b' will have a common type of string
   */
  commonType?: AnyType;
  /**
   * All the types represented in the union
   */
  subTypes: AnyType[];
  /**
   * Type Info
   */
  tsSubTypes?: ts.Type[];
  /**
   * Operation to perform
   */
  operation?: 'and' | 'or';
}

/**
 * Tuple type
 */
export interface TupleType extends Type<'tuple'> {
  /**
   * All the types represented in the tuple
   */
  subTypes: AnyType[];
  /**
   * Type Info
   */
  tsSubTypes?: ts.Type[];
}

/**
 * Pointer to a higher place in the tree
 */
export interface PointerType extends Type<'pointer'> {
  /**
   * Actual type to point to
   */
  target: Exclude<AnyType, PointerType>;
}

/**
 * Foreign type, outside of framework
 */
export interface ForeignType extends Type<'foreign'> {
  /**
   * Identifier for type
   */
  name: string;

  /**
   * Primary source file
   */
  source: string;
}

/**
 * Unknown type, should default to object
 */
export interface UnknownType extends Type<'unknown'> { }

export type AnyType =
  TupleType | ShapeType | CompositionType | LiteralType |
  ManagedType | PointerType | UnknownType | ForeignType | TemplateType;

/**
 * Simple interface for checked methods
 */
export interface TransformResolver {
  isKnownFile(file: string): boolean;
  getFileImportName(file: string, removeExt?: boolean): string;
  getTypeImportName(type: ts.Type, removeExt?: boolean): string | undefined;
  getAllTypeArguments(type: ts.Type): ts.Type[];
  getPropertiesOfType(type: ts.Type): ts.Symbol[];
  getTypeAsString(type: ts.Type): string | undefined;
  getType(node: ts.Node): ts.Type;
}