import ts from 'typescript';

import { TransformerState, OnInterface, OnCall } from '@travetto/transformer';

import { MetadataRegistrationUtil } from './transformer/metadata';

const SRC = '@travetto/runtime/src/types.ts';

/**
 * Providing support for concrete types
 */
export class ConcreteTransformer {

  static #isConcreteSimple(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): boolean {
    return /^\s*[*]\s+@concrete\s+#\s*$/gm.test(node.getFullText());
  }

  static #createConcreteFunction(state: TransformerState, name: string | ts.Identifier): ts.FunctionDeclaration {
    const final = typeof name === 'string' ? name : name.getText();

    const dec = state.factory.createFunctionDeclaration(
      // eslint-disable-next-line no-bitwise
      state.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Export | ts.ModifierFlags.Const),
      undefined, `${final}$Concrete`, [], [], undefined,
      state.factory.createBlock([])
    );

    state.addStatements([dec]);

    return dec;
  }

  /**
   * Handle concrete interface
   */
  @OnInterface()
  static afterInterface(state: TransformerState, node: ts.InterfaceDeclaration): typeof node {
    if (this.#isConcreteSimple(node)) {
      const func = this.#createConcreteFunction(state, node.name);
      MetadataRegistrationUtil.registerFunction(state, func.name!.text, func, func.name!.text);
    }
    return node;
  }

  @OnCall()
  static onAsConcreteCall(state: TransformerState, node: ts.CallExpression): typeof node {
    if (ts.isIdentifier(node.expression) && node.expression.text === 'asConcrete' && node.typeArguments?.length && node.arguments.length === 0) {
      const type = state.resolveType(node.expression);
      if ('importName' in type && type.importName === SRC) {
        const [target] = node.typeArguments;
        const og = state.resolveType(target);
        if (og.key === 'managed') {
          return state.factory.updateCallExpression(
            node,
            node.expression,
            node.typeArguments,
            [state.getOrImport(og)]
          );
        }
      }
    }

    return node;
  }
}