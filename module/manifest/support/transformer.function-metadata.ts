import ts from 'typescript';

import {
  TransformerState, OnMethod, OnClass, AfterClass,
  AfterFunction, CoreUtil, SystemUtil, Import
} from '@travetto/transformer';

import type { FunctionMetadataTag } from '../src/types/common';

const MANIFEST_MOD = '@travetto/manifest';
const MANIFEST_MOD_SRC = `${MANIFEST_MOD}/src`;
const MANIFEST_IDX = `${MANIFEST_MOD}/__index__`;

const METADATA_IDX_IMPORT = `${MANIFEST_MOD_SRC}/metadata`;
const METADATA_IDX_CLS = 'MetadataIndex';

const methods = Symbol.for(`${MANIFEST_MOD}:methods`);
const cls = Symbol.for(`${MANIFEST_MOD}:class`);
const fn = Symbol.for(`${MANIFEST_MOD}:function`);
const metadataIdx = Symbol.for(`${MANIFEST_MOD}:metadataIndex`);

interface MetadataInfo {
  [metadataIdx]?: Import;
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
      return { hash, lines: range };
    } catch (err) {
      return { hash, lines: [0, 0] };
    }
  }

  static #valid({ importName: imp }: TransformerState): boolean {
    return !imp.startsWith(MANIFEST_MOD_SRC) && imp !== MANIFEST_IDX;
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

    state[metadataIdx] ??= state.importFile(METADATA_IDX_IMPORT);
    const ident = state.createAccess(state[metadataIdx].ident, METADATA_IDX_CLS);

    const name = node.name?.escapedText.toString() ?? '';

    const meta = state.factory.createCallExpression(
      state.createAccess(ident, 'register'),
      [],
      [
        state.createIdentifier(name),
        state.getFilenameIdentifier(),
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
  @AfterFunction()
  static registerFunctionMetadata(state: TransformerState & MetadataInfo, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    if (!this.#valid(state)) {
      return node;
    }

    if (ts.isFunctionDeclaration(node) && node.name && node.parent && ts.isSourceFile(node.parent)) {
      // If we have a class like function
      state[metadataIdx] ??= state.importFile(METADATA_IDX_IMPORT);
      const ident = state.createAccess(state[metadataIdx].ident, METADATA_IDX_CLS);
      const tag = this.#tag(state, node);
      const meta = state.factory.createCallExpression(
        state.createAccess(ident, 'register'),
        [],
        [
          state.createIdentifier(node.name),
          state.getFilenameIdentifier(),
          state.fromLiteral(tag),
        ]
      );
      state.addStatements([state.factory.createExpressionStatement(meta)]);
    }
    return node;
  }
}