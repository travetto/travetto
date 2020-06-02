import * as ts from 'typescript';

import { TransformerState, DecoratorMeta, OnProperty, OnClass, AfterClass } from '@travetto/transformer';

const hasConfig = Symbol.for('@trv:config/exists');

interface AutoState {
  [hasConfig]?: boolean;
}

/**
 * Enables the config classes `@Config` to not have to provide an empty value for every optional field
 *
 * By default typescript will compile away fields if they don't have a default value, and config source is
 * relying on fields being available for enumeration.
 */
export class ConfigTransformer {

  @OnClass('trv/config/Config')
  static handleClassBefore(state: AutoState & TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta) {
    state[hasConfig] = !!dm;
    return node;
  }

  @AfterClass('trv/config/Config')
  static handleClassAfter(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators ?? [])];

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

  @OnProperty()
  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    if (state[hasConfig]) {
      if (!node.initializer) {
        node.initializer = ts.createIdentifier('undefined');
      }
    }
    return node;
  }
}