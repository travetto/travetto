import * as ts from 'typescript';

import { TransformUtil, TransformerState, res, OnClass, OnMethod } from '@travetto/compiler/src/transform-support';

import { ParamConfig } from '../src/types';

const CONTROLLER_KEY = 'trv/rest/Controller';
const ENDPOINT_KEY = 'trv/rest/Endpoint';
const PARAM_KEY = 'trv/rest/Param';

const ENDPOINT_DEC_FILE = require.resolve('../src/decorator/endpoint');
const PARAM_DEC_FILE = require.resolve('../src/decorator/param');
const COMMON_DEC_FILE = require.resolve('../src/decorator/common');

export class RestTransformer {

  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration, comments: res.Documentation) {
    const dm = state.getDecoratorList(node)
      .find(x => x.targets?.includes(PARAM_KEY));

    const pDec = dm?.dec;

    const typeName = node.type ? node.type.getText() : '';
    const pName = node.name.getText();

    let decConfig: ParamConfig = { name: pName } as any;
    let commentConfig: res.ParamDoc = {} as any;

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

    const decs = (node.decorators || []).filter(x => x !== pDec);
    commentConfig = (comments.params || []).find(x => x.name === decConfig.name) || {} as res.ParamDoc;

    let rType: any = state.resolveType(node);
    const array = res.isRealType(rType) && rType.realType === Array;
    rType = array ? (rType as res.RealType).realType : rType;
    const type = rType.realType ? ts.createIdentifier(rType.realType) :
      state.getImport(rType);

    let defaultType = 'Query';

    if (typeName === 'Request' || typeName === 'Response') { // Convert to custom types, special handling for interfaces
      rType = ts.createPropertyAccess(state.importFile(PARAM_DEC_FILE).ident, typeName.toUpperCase());
      defaultType = 'Context'; // White list request/response as context
    }

    const common: ParamConfig = {
      description: decConfig.name,
      defaultValue: node.initializer && TransformUtil.toLiteral(node.initializer),
      ...commentConfig,
      ...decConfig,
      required: decConfig.required !== undefined ? decConfig.required : (!(node.questionToken || node.initializer) || commentConfig.required),
      type: type as any,
      array
    };

    if (!pDec) { // Handle default
      state.importDecorator(PARAM_DEC_FILE, defaultType);
      decs.push(state.createDecorator(defaultType,
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

  @OnMethod(ENDPOINT_KEY)
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration) {

    const decls = node.decorators;
    const newDecls = [];

    // Process returnType
    let retType = state.resolveReturnType(node);

    if (res.isRealType(retType) && retType.realType === Promise) {
      retType = retType.typeArguments?.[0]!; // We have a promise nested
    }

    const comments = state.readJSDocs(node);

    // IF we have a winner, declare response type
    if (retType) {
      const type = {
        array: false,
        type: retType
      };
      if (res.isRealType(retType) && retType.realType === Array) {
        type.array = true;
        type.type = retType.typeArguments?.[0]!;
      }
      state.importDecorator(ENDPOINT_DEC_FILE, 'ResponseType');
      const produces = state.createDecorator('ResponseType', TransformUtil.fromLiteral({
        ...type,
        array: type.array,
        title: comments.return
      }));
      newDecls.push(produces);
    }

    // Handle description/title/summary w/e
    if (comments.description) {
      state.importDecorator(COMMON_DEC_FILE, 'Describe');
      newDecls.push(state.createDecorator('Describe', TransformUtil.fromLiteral({
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

  @OnClass(CONTROLLER_KEY)
  static handleController(state: TransformerState, node: ts.ClassDeclaration) {
    // Read title/description/summary from jsdoc on class
    const comments = state.readJSDocs(node);
    if (comments.description) {

      const decls = [...(node.decorators || [])];
      state.importDecorator(COMMON_DEC_FILE, 'Describe');
      decls.push(state.createDecorator('Describe', TransformUtil.fromLiteral({
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
    } else {
      return node;
    }
  }
}