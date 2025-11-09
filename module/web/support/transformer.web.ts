import ts from 'typescript';

import {
  TransformerState, OnMethod, DocUtil, DecoratorUtil, DecoratorMeta, LiteralUtil, AnyType
} from '@travetto/transformer';

import { SchemaTransformUtil } from '@travetto/schema/support/transformer/util.ts';

const PARAM_DEC_IMPORT = '@travetto/web/src/decorator/param.ts';
const ENDPOINT_DEC_IMPORT = '@travetto/web/src/decorator/endpoint.ts';

/**
 * Handle @Controller, @Endpoint
 */
export class WebTransformer {

  /**
   * Handle endpoint parameter
   */
  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration, epDec: DecoratorMeta, idx: number): ts.ParameterDeclaration {
    const pDec = state.findDecorator(this, node, 'Param');
    let pDecArg = DecoratorUtil.getPrimaryArgument(pDec)!;
    if (pDecArg && ts.isStringLiteral(pDecArg)) {
      pDecArg = state.fromLiteral({ name: pDecArg });
    }

    const paramType = state.resolveType(node);
    let name = node.name.getText();
    if (/[{}\[\]]/.test(name)) { // Destructured
      name = `param__${idx + 1}`;
    }

    let detectedParamType: string | undefined;

    const config: { type: AnyType, name?: string } = { type: paramType };

    // Detect default behavior
    // If primitive
    if (paramType.key !== 'managed' && paramType.key !== 'shape') {
      // Get path of endpoint
      const arg = DecoratorUtil.getPrimaryArgument(epDec.dec);
      // If non-regex
      if (arg && ts.isStringLiteral(arg)) {
        const literal = LiteralUtil.toLiteral(arg);
        // If param name matches path param, default to @PathParam
        detectedParamType = new RegExp(`:${name}\\b`).test(literal) ? 'PathParam' : 'QueryParam';
      } else {
        // Default to query for empty or regex endpoints
        detectedParamType = 'QueryParam';
      }
    } else {
      // Treat as schema, and see if endpoint supports a body for default behavior on untyped
      detectedParamType = epDec.targets?.includes('@travetto/web:HttpRequestBody') ? 'Body' : 'QueryParam';
      config.name = '';
    }

    if (paramType.key === 'managed' && paramType.importName.startsWith('@travetto/')) {
      if (paramType.name === 'WebResponse') {
        throw new Error(`${paramType.name} must be registered using @ContextParam`);
      } else if (paramType.name === 'WebRequest') {
        throw new Error(`${paramType.name} is an invalid endpoint parameter`);
      }
    }

    node = SchemaTransformUtil.computeInput(state, node, config);

    const modifiers = (node.modifiers ?? []).filter(x => x !== pDec);
    const conf = state.extendObjectLiteral({ name, sourceText: node.name.getText() }, pDecArg);

    if (!pDec) { // Handle default, missing
      modifiers.push(state.createDecorator(PARAM_DEC_IMPORT, detectedParamType ?? 'QueryParam', conf));
    } else if (ts.isCallExpression(pDec.expression)) { // if it does exist, update
      modifiers.push(state.factory.createDecorator(
        state.factory.createCallExpression(
          pDec.expression.expression,
          [],
          [conf, ...pDec.expression.arguments.slice(1)]
        )
      ));
    }

    return state.factory.updateParameterDeclaration(
      node,
      modifiers,
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

    const modifiers = (node.modifiers ?? []).slice(0);
    const newDecls: ts.ModifierLike[] = [];

    let nParams = node.parameters;

    // Handle parameters
    if (node.parameters.length) {
      const params: ts.ParameterDeclaration[] = [];
      // If there are parameters to process
      let i = 0;
      for (const p of node.parameters) {
        params.push(this.handleEndpointParameter(state, p, dec!, i));
        i += 1;
      }

      nParams = state.factory.createNodeArray(params);
    }

    // If we have a valid response type, declare it
    const nodeType = state.resolveReturnType(node);
    let targetType = nodeType;

    if (nodeType.key === 'literal' && nodeType.typeArguments?.length && nodeType.name === 'Promise') {
      targetType = nodeType.typeArguments[0];
    }

    let inner: AnyType | undefined;
    if (targetType.key === 'managed' && targetType.name === 'WebResponse' && targetType.importName.startsWith('@travetto/web')) {
      inner = state.getApparentTypeOfField(targetType.original!, 'body');
    }

    const comments = DocUtil.describeDocs(node);
    const returnType = SchemaTransformUtil.ensureType(state, inner ?? nodeType, node);
    if (returnType.type) {
      newDecls.push(state.createDecorator(ENDPOINT_DEC_IMPORT, 'ResponseType', state.fromLiteral({
        ...returnType,
        title: comments.return
      })));
    }

    if (newDecls.length || nParams !== node.parameters) {
      return state.factory.updateMethodDeclaration(
        node,
        [...modifiers, ...newDecls],
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
}