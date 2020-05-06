import * as ts from 'typescript';

import { TransformerState, OnProperty, OnStaticMethod, OnMethod, DecoratorMeta, res } from '@travetto/compiler/src/transform-support';

const hasConfig = Symbol.for('_trv_config_has');

interface AutoState {
  [hasConfig]?: boolean;
}

export class SampleTransformer {
  @OnProperty()
  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration, dm?: DecoratorMeta) {
    console.debug('Property Type');
    const resolved = state.resolveType(node);
    console.debug(res.isShapeType(resolved) ? resolved.fields : resolved);
    return node;
  }

  @OnStaticMethod('trv/Custom')
  @OnMethod()
  static handleMethod(state: TransformerState & AutoState, node: ts.MethodDeclaration) {
    console.debug('Return Type');
    console.debug(state.resolveReturnType(node));
    if (node.parameters?.length) {
      console.debug('Parameters');
      for (const param of node.parameters) {
        const resolved = state.resolveType(param);
        console.debug(res.isShapeType(resolved) ? resolved.fields : resolved);
        if (param.initializer) {
          console.debug(state.resolveType(param.initializer));
        }
      }
    }
    return node;
  }
}