import * as ts from 'typescript';

// TODO: Document
export type DecoratorMeta = {
  dec: ts.Decorator;
  ident: ts.Identifier;
  file?: string;
  targets?: string[];
  name?: string;
};

export type State = {
  getDecoratorList(node: ts.Node): DecoratorMeta[];
  finalize(src: ts.SourceFile): ts.SourceFile;
};

export type TransformPhase = 'before' | 'after';

export type TransformerType = 'class' | 'method' | 'property' | 'static-method' | 'call';

export type TransformerSet<S extends State = State> = {
  before?: Map<string, NodeTransformer<S>[]>;
  after?: Map<string, NodeTransformer<S>[]>;
};

export interface NodeTransformer<S extends State = State, T extends TransformerType = TransformerType, N extends ts.Node = ts.Node> {
  type: T;
  target?: string[] | string;
  before?(state: S, node: N, dm?: DecoratorMeta): ts.Node | undefined;
  after?(state: S, node: N, dm?: DecoratorMeta): ts.Node | undefined;
}