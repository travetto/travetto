import * as ts from 'typescript';

export type Import = {
  path: string;
  ident: ts.Identifier;
  stmt?: ts.ImportDeclaration;
  pkg?: string;
};
