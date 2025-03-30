import ts from 'typescript';

import { TransformerState, OnMethod, OnClass, AfterClass, CoreUtil, OnFunction } from '@travetto/transformer';

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

  /**
   * Hash each class
   */
  @OnClass()
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
  @OnMethod()
  static collectMethodMetadata(state: TransformerState & MetadataInfo, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (state[ClassSymbol] && ts.isIdentifier(node.name) && !CoreUtil.isAbstract(node) && ts.isClassDeclaration(node.parent)) {
      state[MethodsSymbol]![node.name.escapedText.toString()] = MetadataRegistrationUtil.tag(state, node);
    }
    return node;
  }

  /**
   * After visiting each class, register all the collected metadata
   */
  @AfterClass()
  static registerClassMetadata(state: TransformerState & MetadataInfo, node: ts.ClassDeclaration): ts.ClassDeclaration {
    if (!state[ClassSymbol]) {
      return node;
    }

    const { [MethodsSymbol]: m, [ClassSymbol]: c } = state;
    delete state[ClassSymbol];
    return MetadataRegistrationUtil.registerClass(state, node, c!, m);
  }

  /**
   * Register proper functions
   */
  @OnFunction()
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