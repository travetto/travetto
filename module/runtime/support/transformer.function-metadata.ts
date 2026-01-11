import ts from 'typescript';

import { type TransformerState, CoreUtil, TransformerHandler } from '@travetto/transformer';

import type { FunctionMetadataTag } from '../src/function.ts';
import { MetadataRegistrationUtil } from './transformer/metadata.ts';

const MethodsSymbol = Symbol();
const ClassSymbol = Symbol();

interface MetadataInfo {
  [MethodsSymbol]?: Record<string, FunctionMetadataTag>;
  [ClassSymbol]?: FunctionMetadataTag;
}

/**
 * Providing metadata for classes
 */
export class RegisterTransformer {

  static {
    TransformerHandler(this, this.collectClassMetadata, 'before', 'class');
    TransformerHandler(this, this.collectMethodMetadata, 'before', 'method');
    TransformerHandler(this, this.registerClassMetadata, 'after', 'class');
    TransformerHandler(this, this.registerFunctionMetadata, 'before', 'function');
  }

  /**
   * Hash each class
   */
  static collectClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!MetadataRegistrationUtil.isValid(state)) {
      return node; // Exclude self
    }

    state[ClassSymbol] = MetadataRegistrationUtil.tag(state, node);
    state[MethodsSymbol] = {};
    return node;
  }

  /**
   * Hash each method
   */
  static collectMethodMetadata(state: TransformerState & MetadataInfo, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (state[ClassSymbol] && ts.isIdentifier(node.name) && !CoreUtil.isAbstract(node) && ts.isClassDeclaration(node.parent)) {
      state[MethodsSymbol]![node.name.escapedText.toString()] = MetadataRegistrationUtil.tag(state, node);
    }
    return node;
  }

  /**
   * After visiting each class, register all the collected metadata
   */
  static registerClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!state[ClassSymbol]) {
      return node;
    }

    const { [MethodsSymbol]: method, [ClassSymbol]: cls } = state;
    delete state[ClassSymbol];
    return MetadataRegistrationUtil.registerClass(state, node, cls!, method);
  }

  /**
   * Register proper functions
   */
  static registerFunctionMetadata(state: TransformerState & MetadataInfo, node: ts.FunctionDeclaration | ts.FunctionExpression): typeof node {
    if (!MetadataRegistrationUtil.isValid(state) || !ts.isFunctionDeclaration(node)) {
      return node;
    }

    if (node.name && node.parent && ts.isSourceFile(node.parent)) {
      MetadataRegistrationUtil.registerFunction(state, node);
    }
    return node;
  }
}