import * as ts from 'typescript';

import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

const CONFIG_CHECKER = TransformUtil.decoratorMatcher('config');

const hasConfig = Symbol('hasConfig');

interface AutoState {
  [hasConfig]?: boolean;
}

class ConfigTransformer {

  static handleClassBefore(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const configs = CONFIG_CHECKER(node, state.imports);
    const config = configs.get('Config');

    state[hasConfig] = !!config;

    return node;
  }

  static handleClassAfter(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators || [])];

    delete state[hasConfig];

    return ts.updateClassDeclaration(
      node,
      ts.createNodeArray(decls),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      node.members
    );
  }

  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    if (state[hasConfig]) {
      if (!node.initializer) {
        node.initializer = ts.createIdentifier('undefined');
      }
    }
    return node;
  }
}

export const transformers: NodeTransformer[] = [
  { type: 'property', all: true, before: ConfigTransformer.handleProperty.bind(ConfigTransformer) },
  {
    type: 'class', aliasName: 'config',
    before: ConfigTransformer.handleClassBefore.bind(ConfigTransformer),
    after: ConfigTransformer.handleClassAfter.bind(ConfigTransformer)
  }
];