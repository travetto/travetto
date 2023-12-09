import ts from 'typescript';

import {
  TransformerState, OnMethod, OnClass, AfterClass,
  AfterFunction, CoreUtil, SystemUtil, Import
} from '@travetto/transformer';

const MANIFEST_MOD = '@travetto/manifest';
const MANIFEST_IDX = `${MANIFEST_MOD}/__index__`;
const ENTRY_POINT = 'support/entry';

const ROOT_IDX_IMPORT = `${MANIFEST_MOD}/src/root-index`;
const ROOT_IDX_CLS = 'RootIndex';

const methods = Symbol.for(`${MANIFEST_MOD}:methods`);
const cls = Symbol.for(`${MANIFEST_MOD}:class`);
const fn = Symbol.for(`${MANIFEST_MOD}:function`);
const rootIdx = Symbol.for(`${MANIFEST_MOD}:rootIndex`);

interface MetadataInfo {
  [rootIdx]?: Import;
  [methods]?: {
    [key: string]: { hash: number };
  };
  [cls]?: number;
  [fn]?: number;
}

/**
 * Providing metadata for classes
 */
export class RegisterTransformer {

  static #valid({ importName: imp }: TransformerState): boolean {
    return !imp.startsWith(MANIFEST_MOD) ?
      !imp.includes(ENTRY_POINT) :
      !(/[/](src|support)[/]/.test(imp) || imp === MANIFEST_IDX);
  }

  /**
   * Hash each class
   */
  @OnClass()
  static collectClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!this.#valid(state)) {
      return node; // Exclude self
    }
    state[cls] = SystemUtil.naiveHash(node.getText());
    return node;
  }

  /**
   * Hash each method
   */
  @OnMethod()
  static collectMethodMetadata(state: TransformerState & MetadataInfo, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (state[cls] && ts.isIdentifier(node.name) && !CoreUtil.isAbstract(node) && ts.isClassDeclaration(node.parent)) {
      const hash = SystemUtil.naiveHash(node.getText());
      const conf = { hash };
      state[methods] ??= {};
      state[methods]![node.name.escapedText.toString()] = conf;
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

    state[rootIdx] ??= state.importFile(ROOT_IDX_IMPORT);
    const ident = state.createAccess(state[rootIdx].ident, ROOT_IDX_CLS);

    const name = node.name?.escapedText.toString() ?? '';

    const meta = state.factory.createCallExpression(
      state.createAccess(ident, 'registerFunction'),
      [],
      [
        state.createIdentifier(name),
        state.getFilenameIdentifier(),
        state.fromLiteral(state[cls]!),
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
      state[rootIdx] ??= state.importFile(ROOT_IDX_IMPORT);
      const ident = state.createAccess(state[rootIdx].ident, ROOT_IDX_CLS);
      const meta = state.factory.createCallExpression(
        state.createAccess(ident, 'registerFunction'),
        [],
        [
          state.createIdentifier(node.name),
          state.getFilenameIdentifier(),
          state.fromLiteral(SystemUtil.naiveHash(node.getText())),
        ]
      );
      state.addStatements([state.factory.createExpressionStatement(meta)]);
    }
    return node;
  }
}