import ts from 'typescript';

import { type TransformerState, TransformerHandler } from '@travetto/transformer';

import { MetadataRegistrationUtil } from './transformer/metadata.ts';

const SRC = '@travetto/runtime/src/types.ts';

/**
 * Providing support for concrete types
 */
export class ConcreteTransformer {

  static {
    TransformerHandler(this, this.onInterface, 'before', 'interface');
    TransformerHandler(this, this.onTypeAlias, 'before', 'type');
    TransformerHandler(this, this.onToConcreteCall, 'before', 'call');
  }

  static #isConcreteSimple(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
    return /^\s*[*]\s+@concrete\s*$/gm.test(node.getFullText());
  }

  static #createConcreteFunction(state: TransformerState, name: string | ts.Identifier): ts.FunctionDeclaration {
    const final = typeof name === 'string' ? name : name.getText();

    const declaration = state.factory.createFunctionDeclaration(
      // eslint-disable-next-line no-bitwise
      state.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Export | ts.ModifierFlags.Const),
      undefined, `${final}$Concrete`, [], [], undefined,
      state.factory.createBlock([])
    );

    state.addStatements([
      declaration,
      state.factory.createExpressionStatement(
        state.factory.createCallExpression(
          state.createAccess('Object', 'defineProperty'),
          undefined,
          [
            declaration.name!,
            state.fromLiteral('name'),
            state.fromLiteral({ value: final })
          ]
        )
      )
    ]);

    return declaration;
  }

  /**
   * Handle concrete interface
   */
  static onInterface(state: TransformerState, node: ts.InterfaceDeclaration): typeof node {
    if (this.#isConcreteSimple(node)) {
      const func = this.#createConcreteFunction(state, node.name);
      MetadataRegistrationUtil.registerFunction(state, func, node);
    }
    return node;
  }

  /**
   * Handle type alias
   */
  static onTypeAlias(state: TransformerState, node: ts.TypeAliasDeclaration): typeof node {
    if (this.#isConcreteSimple(node)) {
      const func = this.#createConcreteFunction(state, node.name);
      MetadataRegistrationUtil.registerFunction(state, func, node);
    }
    return node;
  }

  static onToConcreteCall(state: TransformerState, node: ts.CallExpression): typeof node {
    if (ts.isIdentifier(node.expression) && node.expression.text === 'toConcrete' && node.typeArguments?.length && node.arguments.length === 0) {
      const type = state.resolveType(node.expression);
      if ('importName' in type && type.importName === SRC) {
        const [target] = node.typeArguments;
        return state.factory.updateCallExpression(
          node,
          node.expression,
          node.typeArguments,
          [state.getConcreteType(target)]
        );
      }
    }

    return node;
  }
}