import * as ts from 'typescript';

export type Import = { path: string, ident: ts.Identifier, stmt?: ts.ImportDeclaration, pkg?: string };
export type DecList = ts.NodeArray<ts.Decorator>;

export interface ParamDoc {
  name: string;
  description: string;
  required?: boolean;
  type?: ts.Expression;
}

export interface Documentation {
  return?: { description?: string; type?: ts.Expression };
  description?: string;
  params?: ParamDoc[];
}
