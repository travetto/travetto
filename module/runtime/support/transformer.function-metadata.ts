import ts from 'typescript';

import { TransformerState, OnMethod, OnClass, AfterClass, CoreUtil, SystemUtil, Import, OnFunction, OnInterface } from '@travetto/transformer';

import type { FunctionMetadataTag } from '../src/function';

const RUNTIME_MOD = '@travetto/runtime';
const RUNTIME_MOD_SRC = `${RUNTIME_MOD}/src`;
const REGISTER_IMPORT = `${RUNTIME_MOD_SRC}/function`;

const methods = Symbol.for(`${RUNTIME_MOD}:methods`);
const cls = Symbol.for(`${RUNTIME_MOD}:class`);
const fn = Symbol.for(`${RUNTIME_MOD}:function`);
const registerImport = Symbol.for(`${RUNTIME_MOD}:registerImport`);
const registerFn = 'registerFunction';

interface MetadataInfo {
  [registerImport]?: Import;
  [methods]?: Record<string, FunctionMetadataTag>;
  [cls]?: FunctionMetadataTag;
  [fn]?: number;
}

/**
 * Providing metadata for classes
 */
export class RegisterTransformer {

  static #tag(state: TransformerState, node: ts.Node, text: string): FunctionMetadataTag {
    const hash = SystemUtil.naiveHash(text);
    try {
      const range = CoreUtil.getRangeOf(state.source, node) ?? [0, 0];
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
        const bodyStart = CoreUtil.getRangeOf(state.source, node?.body?.statements[0])?.[0];
        if (bodyStart) {
          range.push(bodyStart);
        }
      }
      return { hash, lines: range };
    } catch {
      return { hash, lines: [0, 0] };
    }
  }

  static #registerFunction(state: TransformerState & MetadataInfo, name: string, node: ts.FunctionDeclaration | ts.FunctionExpression, text: string): void {
    // If we have a class like function
    state[registerImport] ??= state.importFile(REGISTER_IMPORT);
    const tag = this.#tag(state, node, text);
    const meta = state.factory.createCallExpression(
      state.createAccess(state[registerImport].ident, registerFn),
      [],
      [
        state.createIdentifier(name),
        state.getModuleIdentifier(),
        state.fromLiteral(tag),
      ]
    );
    state.addStatements([state.factory.createExpressionStatement(meta)]);
  }

  static #valid({ importName: imp }: TransformerState): boolean {
    return !imp.startsWith(REGISTER_IMPORT);
  }

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
   * Hash each class
   */
  @OnClass()
  static collectClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!this.#valid(state)) {
      return node; // Exclude self
    }
    state[cls] = this.#tag(state, node, node.getText());
    return node;
  }

  /**
   * Hash each method
   */
  @OnMethod()
  static collectMethodMetadata(state: TransformerState & MetadataInfo, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (state[cls] && ts.isIdentifier(node.name) && !CoreUtil.isAbstract(node) && ts.isClassDeclaration(node.parent)) {
      state[methods] ??= {};
      state[methods]![node.name.escapedText.toString()] = this.#tag(state, node, node.getText());
    }
    return node;
  }

  /**
   * After visiting each class, register all the collected metadata
   */
  @AfterClass()
  static registerClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!state[cls]) {
      return node;
    }

    state[registerImport] ??= state.importFile(REGISTER_IMPORT);

    const name = node.name?.escapedText.toString() ?? '';

    const meta = state.factory.createCallExpression(
      state.createAccess(state[registerImport].ident, registerFn),
      [],
      [
        state.createIdentifier(name),
        state.getModuleIdentifier(),
        state.fromLiteral(state[cls]),
        state.extendObjectLiteral(state[methods] || {}),
        state.fromLiteral(CoreUtil.isAbstract(node)),
      ]
    );

    state[methods] = {};
    delete state[cls];

    return state.factory.updateClassDeclaration(
      node,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      [
        state.factory.createClassStaticBlockDeclaration(
          state.factory.createBlock([
            state.factory.createExpressionStatement(meta)
          ])
        ),
        ...node.members
      ]
    );
  }

  /**
   * Give proper functions a file name
   */
  @OnFunction()
  static registerFunctionMetadata(state: TransformerState & MetadataInfo, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    if (!this.#valid(state)) {
      return node;
    }

    if (ts.isFunctionDeclaration(node) && node.name && node.parent && ts.isSourceFile(node.parent)) {
      this.#registerFunction(state, node.name.text, node, node.getText());
    }
    return node;
  }

  /**
   * Handle concrete interface
   */
  @OnInterface()
  static afterInterface(state: TransformerState, node: ts.InterfaceDeclaration): typeof node {
    if (this.#isConcreteSimple(node)) {
      const func = this.#createConcreteFunction(state, node.name);
      this.#registerFunction(state, func.name!.text, func, func.name!.text);
    }
    return node;
  }
}