import * as ts from 'typescript';

import { TransformerState, AfterClass, DecoratorUtil, TransformerId } from '@travetto/transformer';

const REGISTER_MOD = '@travetto/registry/src/decorator';
const BOOT_MOD = '@travetto/boot';

/**
 * Registration of all classes to support the registry
 */
export class RegisterTransformer {

  static [TransformerId] = '@trv:registry';

  /**
   * After visiting each class, register all the collected metadata
   */
  @AfterClass()
  static registerClass(state: TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (state.module === REGISTER_MOD || state.module.startsWith(BOOT_MOD)) {  // Cannot process self
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