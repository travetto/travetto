import * as ts from 'typescript';

import { OnProperty, TransformerState, OnMethod, OnClass, TransformerId } from '@travetto/transformer';

export class MakeUpper {

  static [TransformerId] = '@trv:transformer-test';

  @OnProperty()
  static handleProperty(state: TransformerState, node: ts.PropertyDeclaration): ts.PropertyDeclaration {
    if (!state.source.fileName.includes('doc/src')) {
      return node;
    }
    return state.factory.updatePropertyDeclaration(
      node,
      [],
      node.modifiers,
      node.name.getText().toUpperCase(),
      undefined,
      node.type,
      node.initializer ?? state.createIdentifier('undefined')
    );
  }

  @OnClass()
  static handleClass(state: TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!state.source.fileName.includes('doc/src')) {
      return node;
    }
    return state.factory.updateClassDeclaration(
      node,
      [],
      node.modifiers,
      state.createIdentifier(node.name!.getText().toUpperCase()),
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }

  @OnMethod()
  static handleMethod(state: TransformerState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (!state.source.fileName.includes('doc/src')) {
      return node;
    }
    return state.factory.updateMethodDeclaration(
      node,
      [],
      node.modifiers,
      undefined,
      state.createIdentifier(node.name.getText().toUpperCase()),
      undefined,
      node.typeParameters,
      node.parameters,
      node.type,
      node.body
    );
  }
}