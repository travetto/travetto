import type ts from 'typescript';

import { TransformerHandler, type TransformerState } from '@travetto/transformer';

export class MakeUpper {

  static isValid(state: TransformerState): boolean {
    return state.importName !== '@travetto/transformer/doc/upper.ts';
  }

  static {
    TransformerHandler(this, this.handleClass, 'before', 'class');
    TransformerHandler(this, this.handleMethod, 'before', 'method');
    TransformerHandler(this, this.handleProperty, 'before', 'property');
  }

  static handleProperty(state: TransformerState, node: ts.PropertyDeclaration): ts.PropertyDeclaration {
    return !this.isValid(state) ? node : state.factory.updatePropertyDeclaration(
      node,
      node.modifiers,
      node.name.getText().toUpperCase(),
      undefined,
      node.type,
      node.initializer ?? state.createIdentifier('undefined')
    );
  }

  static handleClass(state: TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    return !this.isValid(state) ? node : state.factory.updateClassDeclaration(
      node,
      node.modifiers,
      state.createIdentifier(node.name!.getText().toUpperCase()),
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }

  static handleMethod(state: TransformerState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    return !this.isValid(state) ? node : state.factory.updateMethodDeclaration(
      node,
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