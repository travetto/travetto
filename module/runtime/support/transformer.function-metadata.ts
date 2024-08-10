import ts from 'typescript';

import {
  TransformerState, OnMethod, OnClass, AfterClass,
  CoreUtil, SystemUtil, Import, OnFunction
} from '@travetto/transformer';

import type { FunctionMetadataTag } from '../src/function';

const RUNTIME_MOD = '@travetto/runtime';
const RUNTIME_MOD_SRC = `${RUNTIME_MOD}/src`;
const REGISTER_IMPORT = `${RUNTIME_MOD_SRC}/function`;

const methods = Symbol.for(`${RUNTIME_MOD}:methods`);
const cls = Symbol.for(`${RUNTIME_MOD}:class`);
const fn = Symbol.for(`${RUNTIME_MOD}:function`);
const registerImport = Symbol.for(`${RUNTIME_MOD}:registerImport`);
const registerFn = 'registerFunction';

interface MetadataInfo {
  [registerImport]?: Import;
  [methods]?: Record<string, FunctionMetadataTag>;
  [cls]?: FunctionMetadataTag;
  [fn]?: number;
}

/**
 * Providing metadata for classes
 */
export class RegisterTransformer {

  static #tag(state: TransformerState, node: ts.Node): FunctionMetadataTag {
    const hash = SystemUtil.naiveHash(node.getText());
    try {
      const range = CoreUtil.getRangeOf(state.source, node) ?? [0, 0];
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
        const bodyStart = CoreUtil.getRangeOf(state.source, node?.body?.statements[0])?.[0];
        if (bodyStart) {
          range.push(bodyStart);
        }
      }
      return { hash, lines: range };
    } catch (err) {
      return { hash, lines: [0, 0] };
    }
  }

  static #valid({ importName: imp }: TransformerState): boolean {
    return !imp.startsWith(REGISTER_IMPORT);
  }

  /**
   * Hash each class
   */
  @OnClass()
  static collectClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!this.#valid(state)) {
      return node; // Exclude self
    }
    state[cls] = this.#tag(state, node);
    return node;
  }

  /**
   * Hash each method
   */
  @OnMethod()
  static collectMethodMetadata(state: TransformerState & MetadataInfo, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (state[cls] && ts.isIdentifier(node.name) && !CoreUtil.isAbstract(node) && ts.isClassDeclaration(node.parent)) {
      state[methods] ??= {};
      state[methods]![node.name.escapedText.toString()] = this.#tag(state, node);
    }
    return node;
  }

  /**
   * After visiting each class, register all the collected metadata
   */
  @AfterClass()
  static registerClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!state[cls]) {
      return node;
    }

    state[registerImport] ??= state.importFile(REGISTER_IMPORT);

    const name = node.name?.escapedText.toString() ?? '';

    const meta = state.factory.createCallExpression(
      state.createAccess(state[registerImport].ident, registerFn),
      [],
      [
        state.createIdentifier(name),
        state.getModuleIdentifier(),
        state.fromLiteral(state[cls]),
        state.extendObjectLiteral(state[methods] || {}),
        state.fromLiteral(CoreUtil.isAbstract(node)),
        state.fromLiteral(name.endsWith(TransformerState.SYNTHETIC_EXT))
      ]
    );

    state[methods] = {};
    delete state[cls];

    return state.factory.updateClassDeclaration(
      node,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      [
        state.createStaticField('Ⲑinit', meta),
        ...node.members
      ]
    );
  }

  /**
   * Give proper functions a file name
   */
  @OnFunction()
  static registerFunctionMetadata(state: TransformerState & MetadataInfo, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    if (!this.#valid(state)) {
      return node;
    }

    if (ts.isFunctionDeclaration(node) && node.name && node.parent && ts.isSourceFile(node.parent)) {
      // If we have a class like function
      state[registerImport] ??= state.importFile(REGISTER_IMPORT);
      const tag = this.#tag(state, node);
      const meta = state.factory.createCallExpression(
        state.createAccess(state[registerImport].ident, registerFn),
        [],
        [
          state.createIdentifier(node.name),
          state.getModuleIdentifier(),
          state.fromLiteral(tag),
        ]
      );
      state.addStatements([state.factory.createExpressionStatement(meta)]);
    }
    return node;
  }
}