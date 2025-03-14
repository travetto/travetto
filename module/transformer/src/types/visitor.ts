import ts from 'typescript';

/**
 * Decorator metadata
 */
export type DecoratorMeta = {
  dec: ts.Decorator;
  ident: ts.Identifier;
  module?: string;
  file?: string;
  targets?: string[];
  name?: string;
};

export type State = {
  source: ts.SourceFile;
  importName: string;
  added: Map<number, ts.Statement[]>;
  getDecoratorList(node: ts.Node): DecoratorMeta[];
  finalize(src: ts.SourceFile): ts.SourceFile;
};

export type TransformPhase = 'before' | 'after';

export type TransformerType =
  'class' | 'method' | 'property' | 'getter' | 'setter' | 'parameter' |
  'static-method' | 'call' | 'function' | 'file' | 'type' | 'interface';

export const ModuleNameSymbol = Symbol.for('@travetto/transformer:id');

export type Transformer = {
  [ModuleNameSymbol]?: string;
  name: string;
};

export type TransformerSet<S extends State = State> = {
  before?: Map<string, NodeTransformer<S>[]>;
  after?: Map<string, NodeTransformer<S>[]>;
};

export interface NodeTransformer<S extends State = State, T extends TransformerType = TransformerType, N extends ts.Node = ts.Node> {
  type: T;
  key: string;
  target?: string[];
  before?<Z extends ts.Node = ts.Node>(state: S, node: N, dm?: DecoratorMeta): Z | undefined;
  after?<Z extends ts.Node = ts.Node>(state: S, node: N, dm?: DecoratorMeta): Z | undefined;
}