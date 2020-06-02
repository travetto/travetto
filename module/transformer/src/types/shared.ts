import * as ts from 'typescript';

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
  params?: ParamDocumentation[];
}

/**
 * Represents an imported token
 */
export type Import = {
  path: string;
  ident: ts.Identifier;
  stmt?: ts.ImportDeclaration;
};
