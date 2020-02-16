import * as ts from 'typescript';

import { TransformUtil } from './util';
import { TransformerState } from './state';

export type TransformerType = 'class' | 'method' | 'property' | 'static-method' | 'call';

type TransformerSet = {
  before: string[];
  after: string[];
  type: TransformerType;
  aliasMap: Map<string, NodeTransformer[]>;
};

export interface NodeTransformer<T extends TransformerType = TransformerType, N = ts.Node> {
  type: T;
  all?: boolean;
  alias?: string[] | string;
  before?(state: TransformerState, node: N, dec?: ts.Decorator): ts.Node | undefined;
  after?(state: TransformerState, node: N, dec?: ts.Decorator): ts.Node | undefined;
}

export class VisitorFactory {

  static nodeToType(node: ts.Node): TransformerType | undefined {
    if (ts.isMethodDeclaration(node)) {
      // eslint-disable-next-line no-bitwise
      return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) ? 'static-method' : 'method';
    } else if (ts.isPropertyDeclaration(node)) {
      return 'property';
    } else if (ts.isCallExpression(node)) {
      return 'call';
    } else if (ts.isClassDeclaration(node)) {
      return 'class';
    }
  }

  private transformers = new Map<TransformerType, TransformerSet>();
  private always = {
    before: new Map<TransformerType, NodeTransformer[]>(),
    after: new Map<TransformerType, NodeTransformer[]>(),
  };

  constructor(
    private getState: (src: ts.SourceFile) => TransformerState,
    transformers: NodeTransformer<any, any>[]
  ) {
    for (const trn of transformers) {
      if (!this.transformers.has(trn.type)) {
        this.transformers.set(trn.type, { before: [], after: [], type: trn.type, aliasMap: new Map() });
      }

      const aliases = trn.alias ? Array.isArray(trn.alias) ? trn.alias : [trn.alias] : [];

      for (const name of aliases) {
        const set = this.transformers.get(trn.type)!;
        if (!set.aliasMap.has(name)) {
          set.aliasMap.set(name, []);
        }
        set.after.push(name);
        set.before.push(name);
        set.aliasMap.get(name)!.push(trn);
      }

      // Handle always run elements
      if (trn.all) {
        for (const p of ['before', 'after'] as const) {
          if (trn[p]) {
            if (!this.always[p].has(trn.type)) {
              this.always[p].set(trn.type, []);
            }
            this.always[p].get(trn.type)!.push(trn);
          }
        }
      }
    }
  }

  visitor(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext) =>
      (file: ts.SourceFile): ts.SourceFile => {
        const state = this.getState(file);
        const ret = this.visit(state, context, file);
        const out = state.finalize(ret);
        return out;
      };
  }

  executePhaseAlways<T extends ts.Node>(state: TransformerState, target: TransformerSet, phase: 'before' | 'after', node: T) {
    const always = this.always[phase].get(target.type);
    if (always && always.length) {
      for (const all of always) {
        const og = node;
        node = (all[phase]!(state, node) as T) || node;
        node.parent = og.parent;
      }
      return node;
    }
  }

  executePhase<T extends ts.Node>(state: TransformerState, target: TransformerSet, phase: 'before' | 'after', node: T) {
    if (target[phase].length) {
      const aliases = new Map();
      for (const dec of TransformUtil.getDecoratorList(node)) {
        for (const alias of state.readAliasDocs(dec.ident)) {
          aliases.set(alias, dec.dec);
        }
      }
      if (!aliases.size) {
        return;
      }

      for (const [key, values] of target.aliasMap.entries()) {
        const dec = aliases.get(key);
        if (!dec) {
          continue;
        }
        for (const item of values) {
          if (item[phase]) {
            const og = node;
            node = (item[phase]!(state, node, dec) as T) ?? node;
            node.parent = og.parent;
          }
        }
      }
      return node;
    }
  }

  visit<T extends ts.Node>(state: TransformerState, context: ts.TransformationContext, node: T): T {
    const target = this.transformers.get(VisitorFactory.nodeToType(node)!);

    if (!target) {
      return ts.visitEachChild(node, c => this.visit(state, context, c), context);
    } else {
      const og = node;

      node =
        this.executePhaseAlways(state, target, 'before', node) ??
        this.executePhase(state, target, 'before', node) ??
        node;

      node = ts.visitEachChild(node, c => this.visit(state, context, c), context);

      node =
        this.executePhaseAlways(state, target, 'after', node) ??
        this.executePhase(state, target, 'after', node) ??
        node;

      if (og !== node) {
        node.parent = og.parent;
        if (ts.isClassDeclaration(node)) {
          for (const el of node.members) {
            if (!el.parent) {
              el.parent = node;
            }
          }
        }
      }

      return node;
    }
  }
}