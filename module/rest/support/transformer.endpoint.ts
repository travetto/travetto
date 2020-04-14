import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, res, OnClass, OnMethod, ParamDoc, Documentation
} from '@travetto/compiler/src/transform-support';

import { ParamConfig } from '../src/types';

const ENDPOINT_DEC_FILE = require.resolve('../src/decorator/endpoint');
const PARAM_DEC_FILE = require.resolve('../src/decorator/param');
const COMMON_DEC_FILE = require.resolve('../src/decorator/common');

export class RestTransformer {

  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration, comments: Documentation) {
    const pDec = state.findDecorator(node, 'trv/rest/Param');

    const pName = node.name.getText();

    let decConfig: ParamConfig = { name: pName } as any;
    let commentConfig: ParamDoc = {} as any;

    const pDecArg = TransformUtil.getPrimaryArgument(pDec);
    if (pDecArg) {
      if (ts.isObjectLiteralExpression(pDecArg)) {
        decConfig = { ...decConfig, ...TransformUtil.toLiteral(pDecArg), };
      } else if (ts.isStringLiteral(pDecArg)) {
        decConfig = { ...decConfig, name: TransformUtil.toLiteral(pDecArg) };
      } else {
        throw new Error('Only literal objects and or strings allows in parameter declarations');
      }
    }

    const decs = (node.decorators ?? []).filter(x => x !== pDec);
    commentConfig = (comments.params ?? []).find(x => x.name === decConfig.name) || {} as ParamDoc;

    let rType: res.Type = state.resolveType(node);
    let array = false;
    if (res.isLiteralType(rType)) {
      array = rType.ctor === Array;
      if (array) {
        rType = rType.typeArguments?.[0]!;
      }
    }

    let type: ts.Expression;
    let defaultType = 'Query';

    if (rType.name === 'Request' || rType.name === 'Response') { // Convert to custom types, special handling for interfaces
      type = ts.createPropertyAccess(state.importFile(PARAM_DEC_FILE).ident, rType.name.toUpperCase());
      defaultType = 'Context'; // White list request/response as context
    } else if (res.isUnionType(rType)) {
      type = ts.createIdentifier('Object');
    } else {
      type = state.typeToIdentifier(rType)!;
    }

    const common: ParamConfig = {
      description: decConfig.name,
      defaultValue: node.initializer && TransformUtil.toLiteral(node.initializer),
      ...commentConfig,
      ...decConfig,
      required: decConfig.required !== undefined ? decConfig.required : !(node.questionToken || node.initializer),
      type: type as any,
      ...(array ? { array: true } : {})
    };

    if (!pDec) { // Handle default
      decs.push(state.createDecorator(PARAM_DEC_FILE, defaultType,
        TransformUtil.fromLiteral(common))
      );
    } else if (ts.isCallExpression(pDec.expression)) {
      pDec.expression.arguments = ts.createNodeArray([
        TransformUtil.fromLiteral(common),
        ...pDec.expression.arguments.slice(1)]
      );
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

  @OnMethod('trv/rest/Endpoint')
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration) {

    const decls = node.decorators;
    const newDecls = [];

    // Process returnType
    let retType = state.resolveReturnType(node);

    if (res.isLiteralType(retType) && retType.ctor === Promise) {
      retType = retType.typeArguments?.[0]!; // We have a promise nested
    }

    const comments = state.readJSDocs(node);

    // IF we have a winner, declare response type
    if (retType) {
      const type: Record<string, any> = {
        type: retType
      };
      if (res.isLiteralType(retType) && retType.ctor === Array) {
        type.array = true;
        type.type = retType.typeArguments?.[0]!;
      }

      if (res.isExternalType(type.type)) {
        type.type = state.typeToIdentifier(type.type) as any;
      } else if (res.isShapeType(type.type)) { // TODO: How do we handle shapes?
        delete type.type;
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
      const params = [] as ts.ParameterDeclaration[];
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

  @OnClass('trv/rest/Controller')
  static handleController(state: TransformerState, node: ts.ClassDeclaration) {
    // Read title/description/summary from jsdoc on class
    const comments = state.readJSDocs(node);

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