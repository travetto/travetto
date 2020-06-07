import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, OnClass, OnMethod, ParamDocumentation, DeclDocumentation
} from '@travetto/transformer';

import { ParamConfig } from '../src/types';

const ENDPOINT_DEC_FILE = require.resolve('../src/decorator/endpoint');
const PARAM_DEC_FILE = require.resolve('../src/decorator/param');
const COMMON_DEC_FILE = require.resolve('../src/decorator/common');

/**
 * Handle @Controller, @Endpoint
 */
export class RestTransformer {

  /**
   * Get base parameter config
   */
  static getParameterConfig(state: TransformerState, node: ts.ParameterDeclaration, comments: DeclDocumentation): Partial<ParamConfig> {
    const pName = node.name.getText();

    const decConfig: Partial<ParamConfig> = { name: pName };
    const commentConfig = (comments.params ?? []).find(x => x.name === decConfig.name) || {} as Partial<ParamDocumentation>;

    return {
      description: decConfig.name!,
      defaultValue: node.initializer,
      ...commentConfig,
      ...decConfig,
      required: !(node.questionToken || node.initializer)
    };
  }

  /**
   * Compute the parameter type
   */
  static getParameterType(state: TransformerState, node: ts.ParameterDeclaration) {

    let paramType = state.resolveType(node);
    let array = false;
    if (paramType.key === 'literal') {
      array = paramType.ctor === Array;
      if (array) {
        paramType = paramType.typeArguments?.[0]!;
      }
    }

    let type: ts.Expression;
    let defaultType = 'Query';

    if (paramType.name === 'Request' || paramType.name === 'Response') { // Convert to custom types, special handling for interfaces
      type = ts.createPropertyAccess(state.importFile(PARAM_DEC_FILE).ident, paramType.name.toUpperCase());
      defaultType = 'Context'; // White list request/response as context
    } else if (paramType.key === 'union') {
      type = ts.createIdentifier('Object');
    } else {
      type = state.typeToIdentifier(paramType)!;
    }

    return { array, type, defaultType };
  }

  /**
   * Handle endpoint parameter
   */
  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration, comments: DeclDocumentation) {
    const pDec = state.findDecorator(node, '@trv:rest/Param');
    let pDecArg = TransformUtil.getPrimaryArgument(pDec)!;
    if (pDecArg && ts.isStringLiteral(pDecArg)) {
      pDecArg = TransformUtil.fromLiteral({ name: pDecArg });
    }

    const { type, array, defaultType } = this.getParameterType(state, node);
    const common = {
      ...this.getParameterConfig(state, node, comments),
      type,
      ...(array ? { array: true } : {})
    };

    const conf = TransformUtil.extendObjectLiteral(common, pDecArg);
    const decs = (node.decorators ?? []).filter(x => x !== pDec);

    if (!pDec) { // Handle default
      decs.push(state.createDecorator(PARAM_DEC_FILE, defaultType, conf));
    } else if (ts.isCallExpression(pDec.expression)) {
      pDec.expression.arguments = ts.createNodeArray([conf, ...pDec.expression.arguments.slice(1)]);
      decs.push(pDec);
    }

    return ts.createParameter(
      decs,
      node.modifiers,
      node.dotDotDotToken,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
  }

  /**
   * On @Endpoint method
   */
  @OnMethod('@trv:rest/Endpoint')
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration) {

    const decls = node.decorators;
    const newDecls = [];

    // Process returnType
    let retType = state.resolveReturnType(node);

    if (retType.key === 'literal' && retType.ctor === Promise) {
      retType = retType.typeArguments?.[0]!; // We have a promise nested
    }

    const comments = state.describeDocs(node);

    // IF we have a winner, declare response type
    if (retType) {
      const type: Record<string, any> = {
        type: retType
      };
      if (retType.key === 'literal' && retType.ctor === Array) {
        type.array = true;
        type.type = retType.typeArguments?.[0]!;
      }

      switch (type.type.key) {
        case 'external': type.type = state.typeToIdentifier(type.type); break;
        // FIXME: How do we handle shapes?
        case 'shape': delete type.type; break;
      }

      const produces = state.createDecorator(ENDPOINT_DEC_FILE, 'ResponseType', TransformUtil.fromLiteral({
        ...type,
        title: comments.return
      }));
      newDecls.push(produces);
    }

    // Handle description/title/summary w/e
    if (comments.description) {
      newDecls.push(state.createDecorator(COMMON_DEC_FILE, 'Describe', TransformUtil.fromLiteral({
        title: comments.description,
      })));
    }

    let nParams = node.parameters;

    // Handle parameters
    if (node.parameters.length) {
      const params: ts.ParameterDeclaration[] = [];
      // If there are parameters to process
      for (const p of node.parameters) {
        params.push(RestTransformer.handleEndpointParameter(state, p, comments));
      }

      nParams = ts.createNodeArray(params);
    }

    if (newDecls.length || nParams !== node.parameters) {
      return ts.createMethod(
        [...decls!, ...newDecls],
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        nParams,
        node.type,
        node.body
      );
    } else {
      return node;
    }
  }

  /**
   * Handle @Controller
   */
  @OnClass('@trv:rest/Controller')
  static handleController(state: TransformerState, node: ts.ClassDeclaration) {
    // Read title/description/summary from jsdoc on class
    const comments = state.describeDocs(node);

    if (!comments.description) {
      return node;
    }

    const decls = [...(node.decorators ?? [])];
    decls.push(state.createDecorator(COMMON_DEC_FILE, 'Describe', TransformUtil.fromLiteral({
      title: comments.description
    })));

    return ts.updateClassDeclaration(
      node,
      ts.createNodeArray(decls),
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }
}