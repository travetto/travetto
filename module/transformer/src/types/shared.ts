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

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && // separate from primitives
  value !== undefined &&
  value !== null && // is obvious
  !Array.isArray(value);

export const isPlainRecord = (value: unknown): value is UnknownRecord =>
  isRecord(value) && // is obvious
  value.constructor === Object && // separate instances (Array, DOM, ...)
  Object.prototype.toString.call(value) === '[object Object]'; // separate build-in like Math
