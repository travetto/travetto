import * as ts from 'typescript';

import { TransformUtil } from './transform-util';
import { TransformerState } from './state';
import { ConfigSource } from '@travetto/config';

export type TransformerType = 'class' | 'method' | 'property' | 'static-method' | 'call';

export type Alias = { name: string, pkg: string };
export type ScopedTransformer = { pkg: string, transformer: NodeTransformer<any, any> };

type TransformerSet = {
  before: Map<string, ScopedTransformer>,
  after: Map<string, ScopedTransformer>
};

export interface NodeTransformer<T extends TransformerType = TransformerType, N = ts.Node> {
  type: T;
  aliasName?: string;
  aliases?: Alias[];
  before?(state: TransformerState, node: N, dec?: ts.Decorator): ts.Node | undefined;
  after?(state: TransformerState, node: N, dec?: ts.Decorator): ts.Node | undefined;
}

export class VisitorFactory {

  static computeAliases(transformer: NodeTransformer) {
    const aliases: Alias[] = (transformer.aliases || []).slice(0);
    if (transformer.aliasName) {
      const obj = ConfigSource.get(transformer.aliasName);
      for (const pkg of Object.keys(obj)) {
        const val = obj[pkg];
        for (const name of Array.isArray(val) ? val : [val]) {
          aliases.push({ name, pkg });
        }
      }
    }
    return aliases;
  }

  private transformers = new Map<TransformerType, TransformerSet>();

  private hasMethod: boolean;
  private hasClass: boolean;
  private hasProperty: boolean;
  private hasCall: boolean;

  constructor(transformers: NodeTransformer<any, any>[]) {
    for (const trn of transformers) {
      if (!this.transformers.has(trn.type)) {
        this.transformers.set(trn.type, {
          before: new Map(),
          after: new Map()
        });
      }

      const aliases = VisitorFactory.computeAliases(trn);

      for (const { name, pkg } of aliases) {
        if (trn.before) {
          this.transformers.get(trn.type)!.before.set(name, { pkg, transformer: trn });
        }
        if (trn.after) {
          this.transformers.get(trn.type)!.after.set(name, { pkg, transformer: trn });
        }
      }
    }
    this.hasMethod = this.transformers.has('method');
    this.hasCall = this.transformers.has('call');
    this.hasClass = this.transformers.has('class');
    this.hasProperty = this.transformers.has('property');
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
    let touched = false;
    const decs = TransformUtil.getDecoratorList(node);
    for (const { dec, ident } of decs) {
      const tgt = target[phase].get(ident);
      if (tgt) {
        const { pkg, transformer } = tgt;
        const { pkg: computedPkg } = state.imports.get(ident)!;
        if (pkg === computedPkg) {
          const ret = (transformer[phase]!(state, node, dec) as T) || node;
          touched = touched || (ret !== node);
          node = ret;
        }
      }
    }

    if (target[phase].has('*')) {
      const ret = (target[phase].get('*')!.transformer[phase]!(state, node) as T) || node;
      touched = touched || (ret !== node);
      node = ret;
    }
    return node;
  }

  visit<T extends ts.Node>(state: TransformerState, context: ts.TransformationContext, node: T): T {

    let target: TransformerSet | undefined;

    if (ts.isMethodDeclaration(node)) {
      if (this.hasMethod) {
        target = (node.modifiers || []).some((x: ts.Modifier) => x.kind === ts.SyntaxKind.StaticKeyword) ?
          this.transformers.get('static-method')! :
          this.transformers.get('method')!;
      }
    } else if (ts.isPropertyDeclaration(node)) {
      target = this.transformers.get('property')!;
    } else if (ts.isCallExpression(node)) {
      target = this.transformers.get('call')!;
    } else if (ts.isClassDeclaration(node)) {
      target = this.transformers.get('class')!;
    }

    let touched = false;

    if (target && target.before.size) {
      const res = this.executePhase(state, target, 'before', node);
      touched = touched || (res !== node);
      node = res;
    }

    const out = ts.visitEachChild(node, c => this.visit(state, context, c), context);
    out.parent = node.parent;
    node = out;

    if (target && target.after.size) {
      const res = this.executePhase(state, target, 'after', node);
      touched = touched || (res !== node);
      node = res;
    }

    if (touched && ts.isClassDeclaration(node)) {
      for (const el of node.members) {
        if (!el.parent) {
          el.parent = node;
        }
      }
    }

    return node;
  }
}