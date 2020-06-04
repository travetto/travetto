import ts = require('typescript');

/**
 * Base type for a simplistic type structure
 */
interface Type<K extends string> {
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
  typeInfo?: ts.Type[];
}

/**
 * A type that is defined structurally (like an interface)
 */
export interface ShapeType extends Type<'shape'> {
  /**
   * Does not include methods, used for shapes not concrete types
   */
  fields: Record<string, AnyType>;

  /**
 * Type Info
 */
  typeInfo?: Record<string, ts.Type>;
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
  typeInfo?: ts.Type[];
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
  unionTypes: AnyType[];
  /**
   * Type Info
   */
  typeInfo?: ts.Type[];
}

/**
 * Tuple type
 */
export interface TupleType extends Type<'tuple'> {
  /**
   * All the types represented in the tuple
   */
  tupleTypes: AnyType[];
  /**
   * Type Info
   */
  typeInfo?: ts.Type[];
}

export type AnyType = TupleType | ShapeType | UnionType | LiteralType | ExternalType;