import * as ts from 'typescript';

import {
  TransformerState, OnMethod, OnClass, AfterClass,
  TransformerId, AfterFunction, CoreUtil, SystemUtil
} from '@travetto/transformer';

const MOD = '@travetto/boot';

const UTIL_MOD = '@travetto/boot/src/internal/class-metadata';
const UTIL_CLS = 'ClassMetadataUtil';

const methods = Symbol.for('@trv:boot/methods');
const cls = Symbol.for('@trv:boot/class');

interface MetadataInfo {
  [methods]?: {
    [key: string]: { hash: number };
  };
  [cls]?: number;
}

/**
 * Providing metadata for classes
 */
export class RegisterTransformer {

  static [TransformerId] = '@trv:boot';

  /**
   * Hash each class
   */
  @OnClass()
  static onClass(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (state.module.startsWith(MOD)) {
      return node; // Exclude self
    }
    state[cls] = SystemUtil.naiveHash(node.getText());
    return node;
  }

  /**
   * Hash each method
   */
  @OnMethod()
  static onMethod(state: TransformerState & MetadataInfo, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (ts.isIdentifier(node.name) && !CoreUtil.isAbstract(node) && ts.isClassDeclaration(node.parent)) {
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
  static afterClass(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!state[cls]) {
      return node;
    }

    const ident = state.importDecorator(UTIL_MOD, UTIL_CLS)!;

    const name = node.name?.escapedText.toString() ?? '';

    const meta = state.factory.createCallExpression(
      state.createAccess(ident, 'initMeta'),
      [],
      [
        state.createIdentifier(name),
        state.createIdentifier('__source'),
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
        state.createStaticField('ᚕinit', meta),
        ...node.members
      ]
    );
  }

  /**
   * Give proper functions a file name
   */
  @AfterFunction()
  static onFunction(state: TransformerState & MetadataInfo, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    if (state.module.startsWith(MOD) || !ts.isFunctionDeclaration(node)) {
      return node;
    }

    if (node.name && /^[A-Z]/.test(node.name.escapedText.toString())) {
      // If we have a class like function
      const ident = state.importDecorator(UTIL_MOD, UTIL_CLS)!;
      const meta = state.factory.createCallExpression(
        state.createAccess(ident, 'initFunctionMeta'),
        [],
        [
          state.createIdentifier(node.name),
          state.createIdentifier('__source'),
        ]
      );
      state.addStatements([
        state.factory.createExpressionStatement(meta)
      ]);
    }
    return node;
  }
}