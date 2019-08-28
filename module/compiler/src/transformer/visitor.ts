import * as ts from 'typescript';

import { TransformUtil } from './util';
import { TransformerState } from './state';

export type TransformerType = 'class' | 'method' | 'property' | 'static-method' | 'call';

export type Alias = { name: string, pkg: string };

type TransformerSet = {
  before: string[],
  after: string[],
  type: TransformerType,
  data: Map<string, Map<string, NodeTransformer[]>>
};

export interface NodeTransformer<T extends TransformerType = TransformerType, N = ts.Node> {
  type: T;
  all?: boolean;
  aliasName?: string;
  aliases?: Alias[];
  before?(state: TransformerState, node: N, dec?: ts.Decorator): ts.Node | undefined;
  after?(state: TransformerState, node: N, dec?: ts.Decorator): ts.Node | undefined;
}

const ALL_MATCHER = TransformUtil.allDecoratorMatcher();

export class VisitorFactory {

  static nodeToType(node: ts.Node): TransformerType | undefined {
    if (ts.isMethodDeclaration(node)) {
      // tslint:disable-next-line: no-bitwise
      return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) ? 'static-method' : 'method';
    } else if (ts.isPropertyDeclaration(node)) {
      return 'property';
    } else if (ts.isCallExpression(node)) {
      return 'call';
    } else if (ts.isClassDeclaration(node)) {
      return 'class';
    }
  }

  static computeAliases(transformer: NodeTransformer) {
    const aliases: Alias[] = (transformer.aliases || []).slice(0);

    if (transformer.aliasName) {
      TransformUtil.aliasMapper(transformer.aliasName, (pkg, cls) => {
        aliases.push({ pkg, name: cls });
      });
    }

    if (transformer.all) {
      aliases.push({ name: '*', pkg: '*' });
    }
    return aliases;
  }

  private transformers = new Map<TransformerType, TransformerSet>();
  private always = {
    before: new Map<TransformerType, NodeTransformer[]>(),
    after: new Map<TransformerType, NodeTransformer[]>(),
  };

  constructor(transformers: NodeTransformer<any, any>[]) {
    for (const trn of transformers) {
      if (!this.transformers.has(trn.type)) {
        this.transformers.set(trn.type, { before: [], after: [], type: trn.type, data: new Map() });
      }

      const aliases = VisitorFactory.computeAliases(trn);

      for (const { name, pkg } of aliases) {
        const set = this.transformers.get(trn.type)!;
        if (!set.data.has(name)) {
          set.data.set(name, new Map());
        }
        set.after.push(name);
        set.before.push(name);
        if (!set.data.get(name)!.has(pkg)) {
          set.data.get(name)!.set(pkg, []);
        }
        set.data.get(name)!.get(pkg)!.push(trn);
      }

      // Handle always run elements
      if (trn.all) {
        for (const p of ['before', 'after'] as ['before', 'after']) {
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

  generate(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext) =>
      (file: ts.SourceFile): ts.SourceFile => {
        const state = new TransformerState(file);
        const ret = this.visit(state, context, file);
        const out = state.finalize(ret);
        return out;
      };
  }

  executePhase<T extends ts.Node>(state: TransformerState, target: TransformerSet, phase: 'before' | 'after', node: T) {
    const always = this.always[phase].get(target.type);
    if (always && always.length) {
      for (const all of always) {
        const og = node;
        node = (all[phase]!(state, node) as T) || node;
        node.parent = og.parent;
      }
    }

    if (target[phase].length) {
      const decs = ALL_MATCHER(node, state.imports);

      for (const [ident, { dec, pkg }] of decs.entries()) {
        const tgt = target.data.get(ident)!.get(pkg);
        if (tgt) {
          for (const el of tgt) {
            if (el[phase]) {
              const og = node;
              node = (el[phase]!(state, node, dec) as T) || node;
              node.parent = og.parent;
            }
          }
        }
      }
    }

    return node;
  }

  visit<T extends ts.Node>(state: TransformerState, context: ts.TransformationContext, node: T): T {
    const target = this.transformers.get(VisitorFactory.nodeToType(node)!);

    if (!target) {
      return ts.visitEachChild(node, c => this.visit(state, context, c), context);
    } else {
      const og = node;

      if (target.before.length || this.always.before.has(target.type)) {
        node = this.executePhase(state, target, 'before', node);
      }

      node = ts.visitEachChild(node, c => this.visit(state, context, c), context);

      if (target.after.length || this.always.after.has(target.type)) {
        node = this.executePhase(state, target, 'after', node);
      }

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