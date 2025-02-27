import * as ts from 'typescript';

import { FunctionMetadataTag } from '@travetto/runtime';
import { CoreUtil, Import, SystemUtil, TransformerState } from '@travetto/transformer';

const RUNTIME_MOD = '@travetto/runtime';

const registerImport = Symbol.for(`${RUNTIME_MOD}:registerImport`);

interface MetadataInfo {
  [registerImport]?: Import;
}

/**
 * Utils for registering function/class metadata at compile time
 */
export class MetadataRegistrationUtil {

  static RUNTIME_MOD_SRC = `${RUNTIME_MOD}/src`;
  static REGISTER_IMPORT = `${this.RUNTIME_MOD_SRC}/function`;
  static REGISTER_FN = 'registerFunction';

  static isValid({ importName: imp }: TransformerState): boolean {
    return !imp.startsWith(this.REGISTER_IMPORT);
  }

  static tag(state: TransformerState, node: ts.Node, text: string): FunctionMetadataTag {
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

  /**
   * Register metadata on a function
   */
  static registerFunction(state: TransformerState & MetadataInfo, name: string, node: ts.FunctionDeclaration | ts.FunctionExpression, text: string): void {
    // If we have a class like function
    state[registerImport] ??= state.importFile(this.REGISTER_IMPORT);

    const tag = this.tag(state, node, text);
    const meta = state.factory.createCallExpression(
      state.createAccess(state[registerImport].ident, this.REGISTER_FN),
      [],
      [
        state.createIdentifier(name),
        state.getModuleIdentifier(),
        state.fromLiteral(tag),
      ]
    );
    state.addStatements([state.factory.createExpressionStatement(meta)]);
  }

  /**
   * Register metadata on a class
   */
  static registerClass(
    state: TransformerState & MetadataInfo, node: ts.ClassDeclaration,
    cls: FunctionMetadataTag, methods?: Record<string, FunctionMetadataTag>
  ): ts.ClassDeclaration {

    state[registerImport] ??= state.importFile(this.REGISTER_IMPORT);

    const name = node.name?.escapedText.toString() ?? '';

    const meta = state.factory.createCallExpression(
      state.createAccess(state[registerImport].ident, this.REGISTER_FN),
      [],
      [
        state.createIdentifier(name),
        state.getModuleIdentifier(),
        state.fromLiteral(cls),
        state.extendObjectLiteral(methods ?? {}),
        state.fromLiteral(CoreUtil.isAbstract(node)),
      ]
    );

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
}