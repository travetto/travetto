import ts from 'typescript';

import { type ManifestModuleFolderType, ManifestModuleUtil } from '@travetto/manifest';

import type { DecoratorMeta, TransformerType, NodeTransformer, TransformerSet, State, TransformPhase } from './types/visitor.ts';
import { CoreUtil } from './util/core.ts';

const COMPILER_SOURCE = new Set<ManifestModuleFolderType>(['support', 'src', '$index']);

/**
 * AST Visitor Factory, combines all active transformers into a single pass transformer for the ts compiler
 */
export class VisitorFactory<S extends State = State> {

  /**
   * Get the type of transformer from a given a ts.node
   */
  static nodeToType(node: ts.Node): TransformerType | undefined {
    if (ts.isConstructorDeclaration(node)) {
      return 'constructor';
    } else if (ts.isMethodDeclaration(node)) {
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
    } else if ((ts.isFunctionDeclaration(node) && node.body) || (ts.isFunctionExpression(node) && !ts.isArrowFunction(node))) {
      return 'function';
    } else if (ts.isGetAccessor(node)) {
      return 'getter';
    } else if (ts.isSetAccessor(node)) {
      return 'setter';
    } else if (ts.isSourceFile(node)) {
      return 'file';
    } else if (ts.isInterfaceDeclaration(node)) {
      return 'interface';
    } else if (ts.isTypeAliasDeclaration(node)) {
      return 'type';
    }
  }

  #transformers = new Map<TransformerType, TransformerSet<S>>();
  #getState: (context: ts.TransformationContext, source: ts.SourceFile) => S;

  constructor(
    getState: (context: ts.TransformationContext, source: ts.SourceFile) => S,
    transformers: NodeTransformer<S, TransformerType, ts.Node>[]
  ) {
    this.#getState = getState;
    this.#init(transformers);
  }

  /**
   * Initialize internal mapping given a list of transformers
   */
  #init(transformers: NodeTransformer<S, TransformerType, ts.Node>[]): void {
    for (const trn of transformers) {
      const set = this.#transformers.getOrInsert(trn.type, new Map());

      const targets = trn.target && trn.target.length ? trn.target : ['__all__'];

      for (const target of targets) {
        for (const phase of ['before', 'after'] as const) {
          if (trn[phase]) {
            set.getOrInsert(phase, new Map()).getOrInsert(target, []).push(trn);
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
      const type = ManifestModuleUtil.getFileType(file.fileName);
      if (type !== 'ts' || /^\/\/\s*@trv-no-transform/.test(file.getFullText())) { // Skip all non-ts files
        return file;
      }

      try {
        const state = this.#getState(context, file);
        // Skip transforming all the compiler related content
        if (
          /@travetto[/](compiler|manifest|transformer)/.test(state.importName) &&
          COMPILER_SOURCE.has(ManifestModuleUtil.getFolderKey(state.importName.replace(/@travetto[/][^/]+[/]/, '')))
        ) {
          return state.finalize(file);
        }

        let node = this.visit(state, context, file);

        // Process added content
        const changed = state.added.size;
        let statements: ts.NodeArray<ts.Statement> | ts.Statement[] = node.statements;
        while (state.added.size) {
          for (const [idx, all] of [...state.added].toSorted(([idxA], [idxB]) => idxB - idxA)) {
            statements = [
              ...statements.slice(0, Math.max(idx, 0)),
              ...all.map(value => this.visit(state, context, value)),
              ...statements.slice(Math.max(idx, 0))
            ];
            state.added.delete(idx);
          }
        }

        if (changed) {
          node = CoreUtil.updateSource(context.factory, node, statements);
        }
        return state.finalize(node);
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }
        console!.error('Failed transforming', { error: `${error.message}\n${error.stack}`, file: file.fileName });
        const out = new Error(`Failed transforming: ${file.fileName}: ${error.message}`);
        out.stack = error.stack;
        throw out;
      }
    };
  }

  /**
   * Handle transformer that target both ascent and descent
   */
  executePhaseAlways<T extends ts.Node>(state: S, set: TransformerSet<S>, phase: TransformPhase, node: T): T | undefined {
    if (!set.get(phase)?.size) {
      return;
    }

    for (const all of set.get(phase)!.get('__all__') ?? []) {
      node = all[phase]!<T>(state, node) ?? node;
    }
    return node;
  }

  /**
   * Handle a single phase of transformation
   */
  executePhase<T extends ts.Node>(state: S, set: TransformerSet<S>, phase: TransformPhase, node: T): T | undefined {
    if (!set.get(phase)?.size) {
      return;
    }

    // Checks for matches of decorators to registered items
    const targets = new Map<string, DecoratorMeta>();
    for (const decorator of state.getDecoratorList(node)) {
      for (const sub of decorator.targets ?? []) {
        targets.set(sub, decorator);
      }
    }

    if (!targets.size) {
      return;
    }

    for (const [key, decorator] of targets.entries()) {
      const values = set.get(phase)!.get(key);
      if (!values || !values.length) {
        continue;
      }

      // For all matching handlers, execute
      for (const item of values) {
        node = item[phase]!<T>(state, node, decorator) ?? node;
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
      return ts.visitEachChild(node, child => this.visit(state, context, child), context);
    } else {
      // Before
      node = this.executePhaseAlways(state, target, 'before', node) ?? node;
      node = this.executePhase(state, target, 'before', node) ?? node;

      node = ts.visitEachChild(node, child => this.visit(state, context, child), context);
      // After
      node = this.executePhaseAlways(state, target, 'after', node) ?? node;
      node = this.executePhase(state, target, 'after', node) ?? node;

      return node;
    }
  }
}