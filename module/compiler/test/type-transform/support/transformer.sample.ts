import * as ts from 'typescript';

import { CompilerUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

const hasConfig = Symbol('hasConfig');

interface AutoState {
  [hasConfig]?: boolean;
}

class ConfigTransformer {

  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    CompilerUtil.log('Property Type');
    CompilerUtil.log(state.resolveType(node));
    return node;
  }

  static handleMethod(state: TransformerState & AutoState, node: ts.MethodDeclaration) {
    CompilerUtil.log('Return Type');
    CompilerUtil.log(state.resolveType(state.checker.getReturnType(node)));
    if (node.parameters?.length) {
      CompilerUtil.log('Parameters');
      for (const param of node.parameters) {
        CompilerUtil.log(state.resolveType(param));
      }
    }
    return node;
  }
}

export const transformers: NodeTransformer[] = [
  { type: 'property', all: true, before: ConfigTransformer.handleProperty.bind(ConfigTransformer) },
  { type: 'method', all: true, before: ConfigTransformer.handleMethod.bind(ConfigTransformer) },
  { type: 'static-method', all: true, before: ConfigTransformer.handleMethod.bind(ConfigTransformer) },
];