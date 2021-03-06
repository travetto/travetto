import * as ts from 'typescript';

import { SystemUtil } from '@travetto/boot/src/internal/system';
import {
  TransformerState, OnMethod, OnClass, AfterClass,
  DecoratorUtil, TransformerId, AfterFunction, CoreUtil
} from '@travetto/transformer';

const REGISTER_MOD = '@travetto/registry/src/decorator';

const methods = Symbol.for('@trv:registry/methods');
const cls = Symbol.for('@trv:registry/class');

interface RegisterInfo {
  [methods]?: {
    [key: string]: { hash: number };
  };
  [cls]?: number;
}

/**
 * Registration of all classes to support the registry
 */
export class RegisterTransformer {

  static [TransformerId] = '@trv:registry';

  /**
   * Hash each class
   */
  @OnClass()
  static preprocessClass(state: TransformerState & RegisterInfo, node: ts.ClassDeclaration) {
    state[cls] = SystemUtil.naiveHash(node.getText());
    return node;
  }

  /**
   * Hash each method
   */
  @OnMethod()
  static processMethod(state: TransformerState & RegisterInfo, node: ts.MethodDeclaration) {
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
  static registerClass(state: TransformerState & RegisterInfo, node: ts.ClassDeclaration) {
    if (state.module === REGISTER_MOD) {  // Cannot process self
      return node;
    }

    const ident = state.importDecorator(REGISTER_MOD, 'Register')!;

    const name = node.name?.escapedText.toString() ?? '';

    const meta = state.factory.createCallExpression(
      state.createAccess(ident, 'initMeta'),
      [],
      [
        state.createIdentifier(name),
        state.getFilenameAsSrc(),
        state.fromLiteral(state[cls]!),
        state.extendObjectLiteral(state[methods] || {}),
        state.fromLiteral(CoreUtil.isAbstract(node)),
        state.fromLiteral(name.endsWith(TransformerState.SYNTHETIC_EXT))
      ]
    );

    state[methods] = {};

    return state.factory.updateClassDeclaration(
      node,
      DecoratorUtil.spliceDecorators(
        node, undefined, [state.createDecorator(REGISTER_MOD, 'Register')], 0
      ),
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
  static registerFunction(state: TransformerState & RegisterInfo, node: ts.FunctionDeclaration | ts.FunctionExpression) {
    if (!ts.isFunctionDeclaration(node)) {
      return node;
    }

    if (node.name && /^[A-Z]/.test(node.name.escapedText.toString())) {
      // If we have a class like function
      state.addStatement(
        state.factory.createExpressionStatement(
          state.factory.createAssignment(
            state.createAccess(node.name, 'ᚕfile'),
            state.getFilenameAsSrc()
          )
        )
      );
    }
    return node;
  }
}