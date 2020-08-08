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

  static key = '@trv:config';

  @OnClass('Config')
  static startConfigClass(state: AutoState & TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta) {
    state[hasConfig] = !!dm;
    return node;
  }

  @AfterClass('Config')
  static finalizeConfigClass(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators ?? [])];

    delete state[hasConfig];

    return state.factory.updateClassDeclaration(
      node,
      decls,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }

  @OnProperty()
  static onConfigProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    if (state[hasConfig] && !node.initializer) {
      return state.factory.updatePropertyDeclaration(
        node,
        node.decorators,
        node.modifiers,
        node.name,
        node.questionToken,
        node.type,
        state.createIdentifier('undefined'),
      );
    }
    return node;
  }
}