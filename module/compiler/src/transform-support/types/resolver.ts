type Primitive = boolean | string | number | RegExp | Date;

export interface ParamDoc {
  name: string;
  description: string;
}

export interface Documentation {
  return?: string;
  description?: string;
  params?: ParamDoc[];
}

export interface Type {
  name?: string; // Name of type, if nominal, otherwise we will generate a unique identifier
  comment?: string;
  undefinable?: boolean;
  nullable?: boolean;
}

export interface ExternalType extends Type {
  source: string; // Location the type came from, for class references
  typeArguments?: Type[]; // Type arguments
}

export interface ShapeType extends Type {
  fields: Record<string, Type>; // Does not include methods, used for shapes not concrete types
}

export interface RealType extends Type {
  realType: Function | undefined; // Pointer to real type (String/Date/Number) if applicable
  value?: Primitive; // Applicable real value
  typeArguments?: Type[]; // Type arguments
}

export interface UnionType extends Type {
  commonType?: Type;
  unionTypes: Type[]; // Array of types
}

export interface TupleType extends Type {
  tupleTypes: Type[]; // Array of types
}

export const isExternalType = (type: Type): type is ExternalType => 'source' in type;
export const isShapeType = (type: Type): type is ShapeType => 'fields' in type;
export const isRealType = (type: Type): type is RealType => 'realType' in type;
export const isUnionType = (type: Type): type is UnionType => 'unionTypes' in type;
export const isTupleType = (type: Type): type is TupleType => 'tupleTypes' in type;