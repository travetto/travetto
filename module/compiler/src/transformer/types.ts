import * as ts from 'typescript';

export type Import = { path: string, ident: ts.Identifier, stmt?: ts.ImportDeclaration, pkg?: string };
export type DecList = ts.NodeArray<ts.Decorator>;

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
  typeArguments?: Type[]; // Type arguments
  comment?: string;
}

export interface ExternalType extends Type {
  source: string; // Location the type came from, for class references
}

export interface ShapeType extends Type {
  fields: Record<string, Type>; // Does not include methods, used for shapes not concrete types
}

export interface RealType extends Type {
  realType: Function | undefined; // Pointer to real type (String/Date/Number) if applicable
  value?: boolean | string | number | RegExp | Date; // Applicable real value
}

export interface UnionType extends Type {
  optional?: boolean; // union types includes undefined
  unionTypes: Type[]; // Array of types
}

export interface TupleType extends Type {
  tupleTypes: Type[]; // Array of types
}