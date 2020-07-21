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

  @OnClass('@trv:config/Config')
  static startConfigClass(state: AutoState & TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta) {
    state[hasConfig] = !!dm;
    return node;
  }

  @AfterClass('@trv:config/Config')
  static finalizeConfigClass(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators ?? [])];

    delete state[hasConfig];

    return ts.updateClassDeclaration(
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
    if (state[hasConfig]) {
      if (!node.initializer) {
        node.initializer = ts.createIdentifier('undefined');
      }
    }
    return node;
  }
}