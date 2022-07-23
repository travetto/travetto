import * as ts from 'typescript';

import {
  TransformerState, OnClass, OnMethod, DocUtil, DecoratorUtil, TransformerId, DecoratorMeta, LiteralUtil
} from '@travetto/transformer';
import { SchemaTransformUtil } from '@travetto/schema/support/transform-util';
import { AnyType } from '@travetto/transformer/src/resolver/types';

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
  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration, epDec: DecoratorMeta): ts.ParameterDeclaration {
    const pDec = state.findDecorator(this, node, 'Param');
    let pDecArg = DecoratorUtil.getPrimaryArgument(pDec)!;
    if (pDecArg && ts.isStringLiteral(pDecArg)) {
      pDecArg = state.fromLiteral({ name: pDecArg });
    }

    const paramType = state.resolveType(node);
    const name = node.name.getText();

    let conf = state.extendObjectLiteral({ name }, pDecArg);
    let detectedParamType: string | undefined;

    const isContext =
      (paramType.key === 'external' &&
        DocUtil.readAugments(paramType.original!.symbol).some(x => x === '@trv:rest/Context')
      ) ||
      (pDec && !/(Path|Header|Query|Body|Param|SchemaQuery)/.test(DecoratorUtil.getDecoratorIdent(pDec).getText()));

    // Detect default behavior
    if (isContext) {
      detectedParamType = 'Context';
      if (paramType.key === 'external') {
        conf = state.extendObjectLiteral(conf, { contextType: state.getOrImport(paramType) });
        node = SchemaTransformUtil.computeField(state, node, { type: { key: 'unknown' } });
      } else {
        throw new Error(`Unexpected parameter type, should be an external type but got: ${paramType.key}`);
      }
    } else {
      // If not contextual
      const config: { type: AnyType, name?: string } = { type: paramType };

      // If primitive
      if (paramType.key !== 'external' && paramType.key !== 'shape') {
        // Get path of endpoint
        const arg = DecoratorUtil.getPrimaryArgument(epDec.dec);
        // If non-regex
        if (arg && ts.isStringLiteral(arg)) {
          const literal = LiteralUtil.toLiteral(arg);
          if (typeof literal !== 'string') {
            throw new Error(`Unexpected literal type: ${literal}`);
          }
          // If param name matches path param, default to @Path
          detectedParamType = new RegExp(`:${name}\\b`).test(literal) ? 'Path' : 'Query';
        } else {
          // Default to query for empty or regex endpoints
          detectedParamType = 'Query';
        }
      } else if (epDec.ident.getText() !== 'All') { // Treat all separate
        // Treat as schema, and see if endpoint supports a body for default behavior on untyped
        detectedParamType = epDec.targets?.includes('@trv:http/Body') ? 'Body' : 'QuerySchema';
        config.name = '';
      }
      node = SchemaTransformUtil.computeField(state, node, config);
    }

    const decs = (node.decorators ?? []).filter(x => x !== pDec);

    if (!pDec) { // Handle default, missing
      decs.push(state.createDecorator(PARAM_DEC_FILE, detectedParamType ?? 'Context', conf));
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
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration, dec?: DecoratorMeta): ts.MethodDeclaration {

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
        params.push(this.handleEndpointParameter(state, p, dec!));
      }

      nParams = state.factory.createNodeArray(params);
    }

    // If we have a valid response type, declare it
    const inner = SchemaTransformUtil.findInnerReturnMethod(state, node, 'render');
    const returnType = SchemaTransformUtil.ensureType(state, state.resolveReturnType(inner ?? node), node);
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
  static handleController(state: TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
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