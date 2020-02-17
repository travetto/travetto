import * as ts from 'typescript';

import { FsUtil } from '@travetto/boot';
import { SystemUtil } from '@travetto/base';
import { TransformUtil, TransformerState, OnMethod, OnClass, AfterClass } from '@travetto/compiler/src/transform-support';

const REGISTER_MOD = require.resolve('../src/decorator');

const methods = Symbol('methods');
const cls = Symbol('class');
const mod = Symbol('module');

interface RegisterInfo {
  [methods]?: {
    [key: string]: { hash: number };
  };
  [mod]?: string;
  [cls]?: number;
}

export class RegisterTransformer {

  @OnClass()
  static prepareClass(state: TransformerState & RegisterInfo, node: ts.ClassDeclaration) {
    state[cls] = SystemUtil.naiveHash(node.getText());
    return node;
  }

  @OnMethod()
  static transformMethod(state: TransformerState & RegisterInfo, node: ts.MethodDeclaration) {
    const hash = SystemUtil.naiveHash(node.getText());

    const conf = { hash };

    state[methods] = state[methods] || {};
    state[methods]![node.name.getText()] = conf;
    return node;
  }

  @AfterClass()
  static transformClass(state: TransformerState & RegisterInfo, node: ts.ClassDeclaration) {
    if (state.source.fileName === REGISTER_MOD) {  // Cannot process self
      return node;
    }

    // eslint-disable-next-line no-bitwise
    const isAbstract = !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Abstract);

    // If needed
    state.importDecorator(REGISTER_MOD, 'Register');

    if (!state[mod]) {
      state[mod] = FsUtil.computeModule(state.source.fileName);
    }

    const body = ts.createNodeArray([
      TransformUtil.createStaticField('__filename', FsUtil.toUnix(state.source.fileName)),
      TransformUtil.createStaticField('__id', `${state[mod]}#${node.name!.getText()}`),
      TransformUtil.createStaticField('__hash', state[cls]!),
      TransformUtil.createStaticField('__methods', TransformUtil.extendObjectLiteral(state[methods] || {})),
      TransformUtil.createStaticField('__abstract', TransformUtil.fromLiteral(isAbstract)),
      ...node.members
    ]);

    state[methods] = {};

    return ts.updateClassDeclaration(node,
      ts.createNodeArray([state.createDecorator('Register'), ...(node.decorators || [])]),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      body
    );
  }
}