import ts from 'typescript';

import {
  TransformerState, OnClass, OnMethod, DocUtil, DecoratorUtil, DecoratorMeta, LiteralUtil, AnyType,
  OnProperty
} from '@travetto/transformer';

import { SchemaTransformUtil } from '@travetto/schema/support/transformer/util.ts';

const PARAM_DEC_IMPORT = '@travetto/web/src/decorator/param.ts';
const COMMON_DEC_IMPORT = '@travetto/web/src/decorator/common.ts';
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
        if (typeof literal !== 'string') {
          throw new Error(`Unexpected literal type: ${literal}`);
        }
        // If param name matches path param, default to @Path
        detectedParamType = new RegExp(`:${name}\\b`).test(literal) ? 'PathParam' : 'QueryParam';
      } else {
        // Default to query for empty or regex endpoints
        detectedParamType = 'Query';
      }
    } else if (epDec.ident.getText() !== 'All') { // Treat all separate
      // Treat as schema, and see if endpoint supports a body for default behavior on untyped
      detectedParamType = epDec.targets?.includes('@travetto/web:HttpRequestBody') ? 'Body' : 'QueryParam';
      config.name = '';
    }

    node = SchemaTransformUtil.computeField(state, node, config);

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

    const comments = DocUtil.describeDocs(node);

    // Handle description/title/summary w/e
    if (comments.description) {
      newDecls.push(state.createDecorator(COMMON_DEC_IMPORT, 'Describe', state.fromLiteral({
        title: comments.description
      })));
    }

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
          ...(node.modifiers ?? []),
          state.createDecorator(COMMON_DEC_IMPORT, 'Describe', state.fromLiteral({
            title: comments.description
          }))
        ],
        node.name,
        node.typeParameters,
        node.heritageClauses,
        node.members
      );
    }
  }

  /**
   * Handle ContextParam annotation
   */
  @OnProperty('ContextParam')
  static registerContextParam(state: TransformerState, node: ts.PropertyDeclaration): typeof node {
    const decl = state.findDecorator(this, node, 'ContextParam', PARAM_DEC_IMPORT);

    // Doing decls
    return state.factory.updatePropertyDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(PARAM_DEC_IMPORT, 'ContextParam', state.fromLiteral({ target: state.getConcreteType(node) }))
      ], 0),
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
  }
}