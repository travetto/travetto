type Primitive = boolean | string | number | RegExp | Date;

/**
 * Base type for a simplistic type structure
 */
export interface Type {
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
export interface ExternalType extends Type {
  /**
   *  Location the type came from, for class references
   */
  source: string;
  /**
   * Type arguments
   */
  typeArguments?: Type[];
}

/**
 * A type that is defined structurally (like an interface)
 */
export interface ShapeType extends Type {
  /**
   * Does not include methods, used for shapes not concrete types
   */
  fields: Record<string, Type>;
}

/**
 * A literal type, with an optional real value
 */
export interface LiteralType extends Type {
  /**
   * Pointer to real type (String/Date/Number) if applicable
   */
  ctor: Function | undefined;
  /**
   * Applicable real value
   */
  value?: Primitive;
  /**
   * Type arguments
   */
  typeArguments?: Type[];
}

/**
 * Union type
 */
export interface UnionType extends Type {
  /**
   * A common type if derivable, e.g. 'a'|'b' will have a common type of string
   */
  commonType?: Type;
  /**
   * All the types represented in the union
   */
  unionTypes: Type[];
}

/**
 * Tuple type
 */
export interface TupleType extends Type {
  /**
   * All the types represented in the tuple
   */
  tupleTypes: Type[];
}

export const isExternalType = (type: Type): type is ExternalType => 'source' in type;
export const isShapeType = (type: Type): type is ShapeType => 'fields' in type;
export const isLiteralType = (type: Type): type is LiteralType => 'ctor' in type;
export const isUnionType = (type: Type): type is UnionType => 'unionTypes' in type;
export const isTupleType = (type: Type): type is TupleType => 'tupleTypes' in type;