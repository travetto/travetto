import * as ts from 'typescript';

import {
  TransformerState, OnClass, OnMethod, ParamDocumentation, DeclDocumentation, DocUtil, LiteralUtil, DecoratorUtil
} from '@travetto/transformer';

import { ParamConfig } from '../src/types';

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
    let defaultType = 'Query';

    switch (paramType.key) {
      case 'literal': {
        array = paramType.ctor === Array;
        if (array) {
          paramType = paramType.typeArguments?.[0]!;
        }
        break;
      }
      case 'external': {
        defaultType = 'Context'; // White list pointer types as context
        break;
      }
      case 'union': {
        paramType = { key: 'literal', ctor: Object, name: 'object' };
      }
    }

    const type = state.typeToIdentifier(paramType)!;
    return { array, type, defaultType };
  }

  /**
   * Handle endpoint parameter
   */
  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration, comments: DeclDocumentation) {
    const pDec = state.findDecorator(node, '@trv:rest/Param');
    let pDecArg = DecoratorUtil.getPrimaryArgument(pDec)!;
    if (pDecArg && ts.isStringLiteral(pDecArg)) {
      pDecArg = LiteralUtil.fromLiteral({ name: pDecArg });
    }

    const { type, array, defaultType } = this.getParameterType(state, node);
    const common = {
      ...this.getParameterConfig(state, node, comments),
      type,
      ...(array ? { array: true } : {})
    };

    const conf = LiteralUtil.extendObjectLiteral(common, pDecArg);
    const decs = (node.decorators ?? []).filter(x => x !== pDec);

    if (!pDec) { // Handle default
      decs.push(state.createDecorator(PARAM_DEC_FILE, defaultType, conf));
    } else if (ts.isCallExpression(pDec.expression)) {
      pDec.expression.arguments = ts.createNodeArray([conf, ...pDec.expression.arguments.slice(1)]);
      decs.push(pDec);
    }

    const ret = ts.updateParameter(
      node,
      decs,
      node.modifiers,
      node.dotDotDotToken,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );

    // Convey parentage
    ret.parent = node.parent;

    return ret;
  }

  /**
   * On @Endpoint method
   */
  @OnMethod('@trv:rest/Endpoint')
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration) {

    const decls = node.decorators;
    const newDecls = [];

    const comments = DocUtil.describeDocs(node);

    // Handle description/title/summary w/e
    if (comments.description) {
      newDecls.push(state.createDecorator(COMMON_DEC_FILE, 'Describe', LiteralUtil.fromLiteral({
        title: comments.description
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
      return ts.updateMethod(
        node,
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
    const comments = DocUtil.describeDocs(node);

    if (!comments.description) {
      return node;
    } else {
      return ts.updateClassDeclaration(
        node,
        [
          ...(node.decorators || []),
          state.createDecorator(COMMON_DEC_FILE, 'Describe', LiteralUtil.fromLiteral({
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