import ts = require('typescript');

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
 * A type that is not defined in the scope of the given file
 */
export interface ExternalType extends Type<'external'> {
  /**
   *  Location the type came from, for class references
   */
  source: string;
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
  source: string;
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
 * Union type
 */
export interface UnionType extends Type<'union'> {
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

export type AnyType = TupleType | ShapeType | UnionType | LiteralType | ExternalType | PointerType;

/**
 * Simple interface for checked methods
 */
export interface Checker {
  getAllTypeArguments(type: ts.Type): ts.Type[];
  getPropertiesOfType(type: ts.Type): ts.Symbol[];
  getTypeAsString(type: ts.Type): string | undefined;
  getType(node: ts.Node): ts.Type;
}