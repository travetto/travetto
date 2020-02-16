import * as ts from 'typescript';

import { TransformerState, OnProperty, OnStaticMethod, OnMethod, DecoratorMeta, res } from '@travetto/compiler/src/transform-support';
import { CompilerUtil } from '@travetto/compiler';

const hasConfig = Symbol('hasConfig');

interface AutoState {
  [hasConfig]?: boolean;
}

export class SampleTransformer {
  @OnProperty()
  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration, dm?: DecoratorMeta) {
    CompilerUtil.log('Property Type');
    const resolved = state.resolveType(node);
    CompilerUtil.log(res.isShapeType(resolved) ? resolved.fields : resolved);
    return node;
  }

  @OnStaticMethod('trv/Custom')
  @OnMethod()
  static handleMethod(state: TransformerState & AutoState, node: ts.MethodDeclaration) {
    CompilerUtil.log('Return Type');
    CompilerUtil.log(state.resolveReturnType(node));
    if (node.parameters?.length) {
      CompilerUtil.log('Parameters');
      for (const param of node.parameters) {
        const resolved = state.resolveType(param);
        CompilerUtil.log(res.isShapeType(resolved) ? resolved.fields : resolved);
        if (param.initializer) {
          CompilerUtil.log(state.resolveType(param.initializer));
        }
      }
    }
    return node;
  }
}