import * as ts from 'typescript';

import { ConsoleManager } from '@travetto/base';

import { DecoratorMeta, TransformerType, NodeTransformer, TransformerSet, State, TransformPhase } from './types/visitor';
import { TransformUtil } from './util';

/**
 * AST Visitor Factory, combines all active transformers into a single pass transformer for the ts compiler
 */
export class VisitorFactory<S extends State = State> {

  /**
   * Get the type of transformer from a given a ts.node
   */
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

  private transformers = new Map<TransformerType, TransformerSet<S>>();

  constructor(
    private getState: (src: ts.SourceFile) => S,
    transformers: NodeTransformer<S, any, any>[]
  ) {
    this.init(transformers);
  }

  /**
   * Initialize internal mapping given a list of transformers
   */
  private init(transformers: NodeTransformer<S, any, any>[]) {
    for (const trn of transformers) {
      if (!this.transformers.has(trn.type)) {
        this.transformers.set(trn.type, {});
      }
      const set = this.transformers.get(trn.type)!;
      const targets = Array.isArray(trn.target) ? trn.target : [trn.target ?? 'ALL'];

      for (const target of targets) {
        for (const phase of ['before', 'after'] as const) {
          if (trn[phase]) {
            if (!set[phase]) {
              set[phase] = new Map();
            }
            if (!set[phase]!.has(target)) {
              set[phase]!.set(target, []);
            }
            set[phase]!.get(target)!.push(trn);
          }
        }
      }
    }
  }

  /**
   * Produce a visitor for a given a file
   */
  visitor(): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext) => (file: ts.SourceFile): ts.SourceFile => {
      try {
        ConsoleManager.setFile('!compiler.log', { processArgs: (__, args) => TransformUtil.collapseNodes(args) }); // Suppress logging into an output file
        console.debug(process.pid, 'Processing', file.fileName);
        const state = this.getState(file);
        const ret = this.visit(state, context, file);
        const out = state.finalize(ret);
        return out;
      } finally {
        ConsoleManager.clear(); // Reset logging
      }
    };
  }

  /**
   * Handle transformer that target both ascent and descent
   */
  executePhaseAlways<T extends ts.Node>(state: S, set: TransformerSet<S>, phase: TransformPhase, node: T) {
    if (!set[phase]?.size) {
      return;
    }

    for (const all of set[phase]!.get('ALL') ?? []) {
      const og = node;
      node = (all[phase]!(state, node) as T) ?? node;
      node.parent = og.parent;
    }
    return node;
  }

  /**
   * Handle a single phase of transformation
   */
  executePhase<T extends ts.Node>(state: S, set: TransformerSet<S>, phase: TransformPhase, node: T) {
    if (!set[phase]?.size) {
      return;
    }

    // Checks for matches of decorators to registered items
    const targets = new Map<string, DecoratorMeta>();
    for (const dec of state.getDecoratorList(node)) {
      for (const sub of dec.targets ?? []) {
        targets.set(sub, dec);
      }
    }

    if (!targets.size) {
      return;
    }

    for (const [key, dec] of targets.entries()) {
      const values = set[phase]!.get(key);
      if (!values || !values.length) {
        continue;
      }

      // For all matching handlers, execute
      for (const item of values) {
        const og = node;
        node = (item[phase]!(state, node, dec) as T) ?? node;
        node.parent = og.parent;
      }
    }
    return node;
  }

  /**
   * Visit an AST node, and check for valid decorators
   */
  visit<T extends ts.Node>(state: S, context: ts.TransformationContext, node: T): T {
    const targetType = VisitorFactory.nodeToType(node)!;
    const target = this.transformers.get(targetType);

    if (!target) {
      return ts.visitEachChild(node, c => this.visit(state, context, c), context);
    } else {
      const og = node;
      // Before
      node = this.executePhaseAlways(state, target, 'before', node) ?? node;
      node = this.executePhase(state, target, 'before', node) ?? node;

      node = ts.visitEachChild(node, c => this.visit(state, context, c), context);
      // After
      node = this.executePhaseAlways(state, target, 'after', node) ?? node;
      node = this.executePhase(state, target, 'after', node) ?? node;

      // Set parents on ascent
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