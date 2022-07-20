import * as ts from 'typescript';
import { createWriteStream } from 'fs';

import { ConsoleManager } from '@travetto/base/src/console';
import { AppCache } from '@travetto/boot';

import { DecoratorMeta, TransformerType, NodeTransformer, TransformerSet, State, TransformPhase } from './types/visitor';
import { LogUtil } from './util/log';
import { CoreUtil } from './util/core';

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
    } else if (ts.isParameter(node)) {
      return 'parameter';
    } else if (ts.isFunctionDeclaration(node) || (ts.isFunctionExpression(node) && !ts.isArrowFunction(node))) {
      return 'function';
    } else if (ts.isGetAccessor(node)) {
      return 'getter';
    } else if (ts.isSetAccessor(node)) {
      return 'setter';
    }
  }

  #transformers = new Map<TransformerType, TransformerSet<S>>();
  #logTarget: string;
  #getState: (context: ts.TransformationContext, src: ts.SourceFile) => S;

  constructor(
    getState: (context: ts.TransformationContext, src: ts.SourceFile) => S,
    transformers: NodeTransformer<S, TransformerType, ts.Node>[],
    logTarget = 'compiler.log'
  ) {
    this.#logTarget = logTarget;
    this.#getState = getState;
    this.#init(transformers);
  }

  /**
   * Initialize internal mapping given a list of transformers
   */
  #init(transformers: NodeTransformer<S, TransformerType, ts.Node>[]) {
    for (const trn of transformers) {
      if (!this.#transformers.has(trn.type)) {
        this.#transformers.set(trn.type, {});
      }
      const set = this.#transformers.get(trn.type)!;
      const targets = trn.target && trn.target.length ? trn.target : ['ALL'];

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
        const c = new console.Console({
          stdout: createWriteStream(AppCache.toEntryName(this.#logTarget), { flags: 'a' }),
          inspectOptions: { depth: 4 },
        });

        ConsoleManager.set({
          onLog: (level, ctx, args) => c[level](level, ctx, ...LogUtil.collapseNodes(args))
        });

        console.debug('Processing', { file: file.fileName, pid: process.pid });
        const state = this.#getState(context, file);
        let ret = this.visit(state, context, file);

        // Process added content
        const changed = state.added.size;
        let statements: ts.NodeArray<ts.Statement> | ts.Statement[] = ret.statements;
        while (state.added.size) {
          for (const [k, all] of [...state.added]) {
            const idx = k === -1 ? state.added.size : k;
            statements = [
              ...statements.slice(0, idx),
              ...all.map(v => this.visit(state, context, v)),
              ...statements.slice(idx)
            ];
            state.added.delete(idx);
          }
        }

        if (changed) {
          ret = CoreUtil.updateSource(context.factory, ret, statements);
        }
        return state.finalize(ret);
      } catch (err: any) {
        console.error('Failed transforming', { error: err, file: file.fileName });
        const out = new Error(`Failed transforming: ${file.fileName}: ${err.message}`);
        out.stack = err.stack;
        throw out;
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
      node = (all[phase]!(state, node) as T) ?? node;
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
        node = (item[phase]!(state, node, dec) as T) ?? node;
      }
    }
    return node;
  }

  /**
   * Visit an AST node, and check for valid decorators
   */
  visit<T extends ts.Node>(state: S, context: ts.TransformationContext, node: T): T {
    const targetType = VisitorFactory.nodeToType(node)!;
    const target = this.#transformers.get(targetType);

    if (!target) {
      return ts.visitEachChild(node, c => this.visit(state, context, c), context);
    } else {
      // Before
      node = this.executePhaseAlways(state, target, 'before', node) ?? node;
      node = this.executePhase(state, target, 'before', node) ?? node;

      node = ts.visitEachChild(node, c => this.visit(state, context, c), context);
      // After
      node = this.executePhaseAlways(state, target, 'after', node) ?? node;
      node = this.executePhase(state, target, 'after', node) ?? node;

      return node;
    }
  }
}