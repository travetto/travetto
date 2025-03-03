import * as ts from 'typescript';

import { FunctionMetadataTag } from '@travetto/runtime';
import { CoreUtil, Import, SystemUtil, TransformerState } from '@travetto/transformer';

const registerImport = Symbol.for('@travetto/runtime:registerImport');

interface MetadataInfo {
  [registerImport]?: Import;
}

/**
 * Utils for registering function/class metadata at compile time
 */
export class MetadataRegistrationUtil {

  static REGISTER_IMPORT = '@travetto/runtime/src/function.ts';
  static REGISTER_FN = 'registerFunction';

  static isValid({ importName: imp }: TransformerState): boolean {
    return imp !== this.REGISTER_IMPORT;
  }

  static tag(state: TransformerState, node: ts.Node): FunctionMetadataTag {
    const text = node.getText();
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
  static registerFunction(state: TransformerState & MetadataInfo,
    node: ts.FunctionDeclaration | ts.FunctionExpression,
    src?: ts.FunctionDeclaration | ts.FunctionExpression | ts.InterfaceDeclaration | ts.TypeAliasDeclaration
  ): void {
    // If we have a class like function
    state[registerImport] ??= state.importFile(this.REGISTER_IMPORT);

    const tag = this.tag(state, src ?? node);
    const meta = state.factory.createCallExpression(
      state.createAccess(state[registerImport].ident, this.REGISTER_FN),
      [],
      [
        state.createIdentifier(node.name!.text),
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