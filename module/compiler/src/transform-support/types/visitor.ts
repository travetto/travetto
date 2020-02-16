import * as ts from 'typescript';
import { DecoratorMeta } from './decorator';

export type State = {
  getDecoratorList(node: ts.Node): DecoratorMeta[];
  finalize(src: ts.SourceFile): ts.SourceFile;
};

export type TransformPhase = 'before' | 'after';

export type TransformerType = 'class' | 'method' | 'property' | 'static-method' | 'call';

export type TransformerSet<S extends State = State> = {
  before: Set<string>;
  after: Set<string>;
  type: TransformerType;
  targetMap: Map<string, NodeTransformer<S>[]>;
};

export interface NodeTransformer<S extends State = State, T extends TransformerType = TransformerType, N extends ts.Node = ts.Node> {
  type: T;
  target?: string[] | string;
  before?(state: S, node: N, dm?: DecoratorMeta): ts.Node | undefined;
  after?(state: S, node: N, dm?: DecoratorMeta): ts.Node | undefined;
}