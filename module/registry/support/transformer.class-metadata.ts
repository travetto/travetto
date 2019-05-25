import * as ts from 'typescript';

import { FsUtil, RegisterUtil } from '@travetto/boot';
import { Util } from '@travetto/base';
import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

const REGISTER_MOD = require.resolve('../src/decorator');

const methods = Symbol('methods');
const mod = Symbol('module');

interface RegisterInfo {
  [methods]?: {
    [key: string]: { hash: string }
  };
  [mod]?: string;
}

class RegisterTransformer {

  static transformMethod(state: TransformerState & RegisterInfo, node: ts.MethodDeclaration) {
    const hash = Util.naiveHash(node.getText());

    const conf: any = {
      hash
    };

    state[methods] = state[methods] || {};
    state[methods]![node.name.getText()] = conf;
    return node;
  }

  static transformClass(state: TransformerState & RegisterInfo, node: ts.ClassDeclaration, dec: ts.Decorator) {
    if (
      state.path === REGISTER_MOD || // Cannot process self
      !(node.name && node.parent && ts.isSourceFile(node.parent)) // If not top level, skip
    ) {
      return;
    }

    const isAbstract = (node.modifiers! || []).filter(x => x.kind === ts.SyntaxKind.AbstractKeyword).length > 0;

    // If needed
    state.importDecorator(REGISTER_MOD, 'Register');

    if (!state[mod]) {
      state[mod] = RegisterUtil.computeModuleFromFile(state.source.fileName);
    }

    const body = ts.createNodeArray([
      TransformUtil.createStaticField('__filename', FsUtil.toUnix(state.source.fileName)),
      TransformUtil.createStaticField('__id', `${state[mod]}#${node.name!.getText()}`),
      TransformUtil.createStaticField('__hash', Util.naiveHash(node.getText())),
      TransformUtil.createStaticField('__methods', TransformUtil.extendObjectLiteral(state[methods] || {})),
      TransformUtil.createStaticField('__abstract', TransformUtil.fromLiteral(isAbstract)),
      ...node.members
    ]);

    const ret = ts.updateClassDeclaration(node,
      ts.createNodeArray([state.createDecorator('Register'), ...(node.decorators || [])]),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      body
    );

    state[methods] = {};

    ret.parent = node.parent;

    for (const el of ret.members) {
      if (!el.parent) {
        el.parent = ret;
      }
    }

    return ret;
  }
}

export const transformers: NodeTransformer[] = [
  {
    type: 'class',
    aliases: ['*'],
    after: RegisterTransformer.transformClass
  },
  {
    type: 'method',
    aliases: ['*'],
    before: RegisterTransformer.transformMethod
  }
];
