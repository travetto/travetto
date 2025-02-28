import ts from 'typescript';

import { TransformerState, OnMethod, OnClass, AfterClass, CoreUtil, OnFunction } from '@travetto/transformer';

import type { FunctionMetadataTag } from '../src/function';
import { MetadataRegistrationUtil } from './transformer/metadata';

const RUNTIME_MOD = '@travetto/runtime';

const methods = Symbol.for(`${RUNTIME_MOD}:methods`);
const cls = Symbol.for(`${RUNTIME_MOD}:class`);
const fn = Symbol.for(`${RUNTIME_MOD}:function`);

interface MetadataInfo {
  [methods]?: Record<string, FunctionMetadataTag>;
  [cls]?: FunctionMetadataTag;
  [fn]?: number;
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

    state[cls] = MetadataRegistrationUtil.tag(state, node);
    state[methods] = {};
    return node;
  }

  /**
   * Hash each method
   */
  @OnMethod()
  static collectMethodMetadata(state: TransformerState & MetadataInfo, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (state[cls] && ts.isIdentifier(node.name) && !CoreUtil.isAbstract(node) && ts.isClassDeclaration(node.parent)) {
      state[methods]![node.name.escapedText.toString()] = MetadataRegistrationUtil.tag(state, node);
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

    const { [methods]: m, [cls]: c } = state;
    delete state[cls];
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