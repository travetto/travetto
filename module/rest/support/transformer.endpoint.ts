import * as ts from 'typescript';

import {
  TransformerState, OnClass, OnMethod, DocUtil, DecoratorUtil, TransformerId
} from '@travetto/transformer';
import { SchemaTransformUtil } from '@travetto/schema/support/lib';

import { RestTransformUtil } from './lib';

const PARAM_DEC_FILE = '@travetto/rest/src/decorator/param';
const COMMON_DEC_FILE = '@travetto/rest/src/decorator/common';
const ENDPOINT_DEC_FILE = '@travetto/rest/src/decorator/endpoint';

/**
 * Handle @Controller, @Endpoint
 */
export class RestTransformer {

  static [TransformerId] = '@trv:rest';

  /**
   * Handle endpoint parameter
   */
  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration) {
    const pDec = state.findDecorator(this, node, 'Param');
    let pDecArg = DecoratorUtil.getPrimaryArgument(pDec)!;
    if (pDecArg && ts.isStringLiteral(pDecArg)) {
      pDecArg = state.fromLiteral({ name: pDecArg });
    }

    const paramType = state.resolveType(node);

    const dm = pDec ? state.getDecoratorMeta(pDec) : undefined;
    const defaultType = paramType.key === 'external' ? 'Context' : 'Query';
    const common = { name: node.name.getText() };

    let conf = state.extendObjectLiteral(common, pDecArg);

    if (paramType.key === 'external' && !/^(Body|SchemaQuery)$/.test(dm?.name!)) { // contextual
      conf = state.extendObjectLiteral(conf, {
        contextType: state.getOrImport(paramType)
      });
    }
    if (paramType.key !== 'external' || /^(Body|SchemaQuery)$/.test(dm?.name!)) { // Not contextual) {
      node = SchemaTransformUtil.computeField(state, node, /^(Body|SchemaQuery)$/.test(dm?.name!) ? { name: '', type: paramType } : { type: paramType });
    }

    const decs = (node.decorators ?? []).filter(x => x !== pDec);

    if (!pDec) { // Handle default, missing
      decs.push(state.createDecorator(PARAM_DEC_FILE, defaultType, conf));
    } else if (ts.isCallExpression(pDec.expression)) { // if it does exist, update
      decs.push(state.factory.createDecorator(
        state.factory.createCallExpression(
          pDec.expression.expression,
          [],
          [conf, ...pDec.expression.arguments.slice(1)]
        )
      ));
    }

    return state.factory.updateParameterDeclaration(
      node,
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
  @OnMethod('Endpoint')
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration) {

    const decls = node.decorators ?? [];
    const newDecls = [];

    const comments = DocUtil.describeDocs(node);

    // Handle description/title/summary w/e
    if (comments.description) {
      newDecls.push(state.createDecorator(COMMON_DEC_FILE, 'Describe', state.fromLiteral({
        title: comments.description
      })));
    }

    let nParams = node.parameters;

    // Handle parameters
    if (node.parameters.length) {
      const params: ts.ParameterDeclaration[] = [];
      // If there are parameters to process
      for (const p of node.parameters) {
        params.push(this.handleEndpointParameter(state, p));
      }

      nParams = state.factory.createNodeArray(params);
    }

    // If we have a valid response type, declare it
    const returnType = RestTransformUtil.resolveReturnType(state, node);
    if (returnType.type) {
      newDecls.push(state.createDecorator(ENDPOINT_DEC_FILE, 'ResponseType', state.fromLiteral({
        ...returnType,
        title: comments.return
      })));
    }

    if (newDecls.length || nParams !== node.parameters) {
      return state.factory.updateMethodDeclaration(
        node,
        [...decls, ...newDecls],
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
  @OnClass('Controller')
  static handleController(state: TransformerState, node: ts.ClassDeclaration) {
    // Read title/description/summary from jsdoc on class
    const comments = DocUtil.describeDocs(node);

    if (!comments.description) {
      return node;
    } else {
      return state.factory.updateClassDeclaration(
        node,
        [
          ...(node.decorators || []),
          state.createDecorator(COMMON_DEC_FILE, 'Describe', state.fromLiteral({
            title: comments.description
          }))
        ],
        node.modifiers,
        node.name,
        node.typeParameters,
        node.heritageClauses,
        node.members
      );
    }
  }
}