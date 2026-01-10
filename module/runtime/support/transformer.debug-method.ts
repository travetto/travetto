import type ts from 'typescript';

import { type TransformerState, CoreUtil, RegisterHandler } from '@travetto/transformer';

const DebugSymbol = Symbol();

/**
 * Debug transformation state
 */
interface DebugState {
  [DebugSymbol]?: ts.Expression;
}

/**
 * Add debugger-optional statement to methods that should be debuggable
 */
export class DebugEntryTransformer {

  static {
    RegisterHandler(this, this.debugOnEntry, 'before', 'method', ['DebugBreak']);
  }

  static debugOnEntry(state: TransformerState & DebugState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (!state[DebugSymbol]) {
      const imp = state.importFile('@travetto/runtime/src/debug.ts').identifier;
      state[DebugSymbol] = CoreUtil.createAccess(state.factory, imp, 'tryDebugger');
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
        state.factory.createIfStatement(state[DebugSymbol]!,
          state.factory.createExpressionStatement(state.factory.createIdentifier('debugger'))),
        ...node.body.statements
      ]) : node.body
    );
  }
}