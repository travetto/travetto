import * as ts from 'typescript';

// TODO: Document
export interface ParamDoc {
  name: string;
  description: string;
}

export interface Documentation {
  return?: string;
  description?: string;
  params?: ParamDoc[];
}

export type Import = {
  path: string;
  ident: ts.Identifier;
  stmt?: ts.ImportDeclaration;
};
