import type ts from 'typescript';

/**
 * Param documentation
 */
export interface ParamDocumentation {
  name: string;
  description: string;
}

/**
 * Declaration documentation
 */
export interface DeclDocumentation {
  return?: string;
  description?: string;
  examples?: string[];
  params?: ParamDocumentation[];
}

/**
 * Represents an imported token
 */
export type Import = {
  path: string;
  identifier: ts.Identifier;
  statement?: ts.ImportDeclaration;
};

/** Template Literal Types */
export type TemplateLiteralPart = string | NumberConstructor | StringConstructor | BooleanConstructor | BigIntConstructor;
export type TemplateLiteral = { operation: 'and' | 'or'; values: (TemplateLiteralPart | TemplateLiteral)[] };

export function transformCast<T>(input: unknown): T {
  return input as T;
}
