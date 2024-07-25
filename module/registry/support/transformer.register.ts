import ts from 'typescript';

import { TransformerState, AfterClass, DecoratorUtil } from '@travetto/transformer';

const REGISTER_MOD = '@travetto/registry/src/decorator';
const SKIP_SRC = /^@travetto\/(base|manifest)\/(src|support)/;
const SKIP_FUNCTION = /^@travetto\/registry\/src\/function/;

/**
 * Registration of all classes to support the registry
 */
export class RegisterTransformer {

  /**
   * After visiting each class, register all the collected metadata
   */
  @AfterClass()
  static registerClass(state: TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (
      state.importName === REGISTER_MOD ||
      SKIP_SRC.test(state.importName) ||
      SKIP_FUNCTION.test(state.importName)
    ) {  // Cannot process self
      return node;
    }

    return state.factory.updateClassDeclaration(
      node,
      DecoratorUtil.spliceDecorators(
        node, undefined, [state.createDecorator(REGISTER_MOD, 'Register')], 0
      ),
      node.name,
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }
}