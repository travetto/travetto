import * as ts from 'typescript';

import { SystemUtil } from '@travetto/base/src/internal/system';
import { TransformerState, OnMethod, OnClass, AfterClass, LiteralUtil, CoreUtil, DecoratorUtil } from '@travetto/transformer';

const REGISTER_MOD = require.resolve('../src/decorator');

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

  /**
   * Hash each class
   */
  @OnClass()
  static prepareClass(state: TransformerState & RegisterInfo, node: ts.ClassDeclaration) {
    state[cls] = SystemUtil.naiveHash(node.getText());
    return node;
  }

  /**
   * Hash each method
   */
  @OnMethod()
  static transformMethod(state: TransformerState & RegisterInfo, node: ts.MethodDeclaration) {
    const hash = SystemUtil.naiveHash(node.getText());

    const conf = { hash };

    state[methods] = state[methods] || {};
    state[methods]![node.name.getText()] = conf;
    return node;
  }

  /**
   * After visiting each class, register all the collected metadata
   */
  @AfterClass()
  static transformClass(state: TransformerState & RegisterInfo, node: ts.ClassDeclaration) {
    if (state.source.fileName === REGISTER_MOD) {  // Cannot process self
      return node;
    }

    // eslint-disable-next-line no-bitwise
    const isAbstract = !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Abstract);

    const ident = state.importDecorator(REGISTER_MOD, 'Register')!;

    const name = node.name?.escapedText.toString()!;

    const meta = ts.createCall(
      ts.createPropertyAccess(ident, 'initMeta'),
      [],
      [
        ts.createIdentifier(name),
        ts.createPropertyAccess(ts.createIdentifier('__filename'), 'ᚕunix'),
        ts.createLiteral(state[cls]!),
        LiteralUtil.extendObjectLiteral(state[methods] || {}),
        ts.createLiteral(isAbstract),
        ts.createLiteral(name.endsWith('__syn'))
      ]
    );

    state[methods] = {};

    return ts.updateClassDeclaration(
      node,
      DecoratorUtil.spliceDecorators(
        node, undefined, [state.createDecorator(REGISTER_MOD, 'Register')], 0
      ),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      [
        CoreUtil.createStaticField('__init', meta),
        ...node.members
      ]
    );
  }
}