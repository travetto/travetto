import * as ts from 'typescript';

export type DecoratorMeta = {
  dec: ts.Decorator;
  ident: ts.Identifier;
  targets?: string[];
  name?: string;
};
