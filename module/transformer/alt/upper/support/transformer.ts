import * as ts from 'typescript';

import { OnProperty, TransformerState, OnMethod, OnClass } from '../../..';

export class MakeUpper {
  @OnProperty()
  static handleProperty(state: TransformerState, node: ts.PropertyDeclaration) {
    return ts.updateProperty(
      node,
      [],
      node.modifiers,
      node.name.getText().toUpperCase(),
      undefined,
      node.type,
      node.initializer ?? ts.createIdentifier('undefined')
    );
  }

  @OnClass()
  static handleClass(state: TransformerState, node: ts.ClassDeclaration) {
    return ts.updateClassDeclaration(
      node,
      [],
      node.modifiers,
      ts.createIdentifier(node.name!.getText().toUpperCase()),
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }

  @OnMethod()
  static handleMethod(state: TransformerState, node: ts.MethodDeclaration) {
    return ts.updateMethod(
      node,
      [],
      node.modifiers,
      undefined,
      ts.createIdentifier(node.name.getText().toUpperCase()),
      undefined,
      node.typeParameters,
      node.parameters,
      node.type,
      node.body
    );
  }
}