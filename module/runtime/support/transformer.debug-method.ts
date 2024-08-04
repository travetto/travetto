import ts from 'typescript';

import { TransformerState, OnMethod, CoreUtil } from '@travetto/transformer';

const DebugⲐ = Symbol.for('@travetto/runtime:debug');

/**
 * Debug transformation state
 */
interface DebugState {
  [DebugⲐ]?: ts.Expression;
}

/**
 * Add debugger-optional statement to methods that should be debuggable
 */
export class DebugEntryTransformer {

  @OnMethod('DebugBreak')
  static debugOnEntry(state: TransformerState & DebugState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (!state[DebugⲐ]) {
      const imp = state.importFile('@travetto/runtime/src/debug').ident;
      state[DebugⲐ] = CoreUtil.createAccess(state.factory, imp, 'tryDebugger');
    }

    return state.factory.updateMethodDeclaration(node,
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.questionToken,
      node.typeParameters,
      node.parameters,
      node.type,
      node.body ? state.factory.updateBlock(node.body, [
        state.factory.createIfStatement(state[DebugⲐ]!,
          state.factory.createExpressionStatement(state.factory.createIdentifier('debugger'))),
        ...node.body.statements
      ]) : node.body
    );
  }
}