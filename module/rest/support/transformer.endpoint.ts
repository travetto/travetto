import * as ts from 'typescript';

import { TransformUtil, TransformerState, Documentation, ParamDoc, NodeTransformer, CompilerUtil } from '@travetto/compiler';
import { ParamConfig } from '../src/types';

const ENDPOINT_DEC_FILE = require.resolve('../src/decorator/endpoint');
const PARAM_DEC_FILE = require.resolve('../src/decorator/param');
const COMMON_DEC_FILE = require.resolve('../src/decorator/common');

const PARAM_MATCHER = TransformUtil.decoratorMatcher('rest-param');

class RestTransformer {

  static defineType(state: TransformerState, type: ts.Expression | ts.TypeNode) {

    let typeIdent: ts.Expression | ts.TypeNode = type;
    let isArray: boolean = false;

    if (!ts.isTypeNode(typeIdent)) {
      if (ts.isArrayLiteralExpression(type)) {
        isArray = true;
        typeIdent = type.elements[0];
      }
    } else {
      if (ts.isArrayTypeNode(type)) {
        isArray = true;
        typeIdent = type.elementType;
      }
    }

    const finalTarget = !ts.isTypeNode(typeIdent) ? typeIdent : state.resolveType(typeIdent);

    return { type: finalTarget, array: isArray };
  }

  static handleEndpointParameter(state: TransformerState, node: ts.ParameterDeclaration, comments: Documentation) {
    const typeName = node.type ? node.type.getText() : '';
    const pName = node.name.getText();

    let decConfig: ParamConfig = { name: pName } as any;
    let commentConfig: ParamDoc = {} as any;

    const allMatched = PARAM_MATCHER(node, state.imports);
    const pDec = allMatched.size ? allMatched.values().next().value : undefined;

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
    commentConfig = (comments.params || []).find(x => x.name === decConfig.name) || {} as ParamDoc;

    const type = RestTransformer.defineType(state, commentConfig.type! || node.type! || ts.createIdentifier('String'));

    let defaultType = 'Query';

    if (typeName === 'Request' || typeName === 'Response') { // Convert to custom types, special handling for interfaces
      type.type = ts.createPropertyAccess(state.importFile(PARAM_DEC_FILE).ident, typeName.toUpperCase());
      defaultType = 'Context'; // White list request/response as context
    }

    const common: ParamConfig = {
      description: decConfig.name,
      defaultValue: node.initializer && TransformUtil.toLiteral(node.initializer),
      ...commentConfig,
      ...decConfig,
      required: decConfig.required !== undefined ? decConfig.required : (!(node.questionToken || node.initializer) || commentConfig.required),
      type: type.type as any,
      array: type.array
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

  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration) {

    const decls = node.decorators;
    const newDecls = [];

    // Process returnType

    const comments = state.describeByComments(node);

    // Get return type from jsdoc comments
    const sig = state.checker.getTypeAtLocation(node).getCallSignatures()[0];

    let mType: any = state.checker.getReturnTypeOfSignature(sig);
    let retType;

    // If comments empty, read from method node
    if (mType.symbol.getName() === 'Promise') {
      mType = mType.resolvedTypeArguments && mType.resolvedTypeArguments.length ? mType.resolvedTypeArguments[0] : mType;
    }
    if (mType.intrinsicName !== 'void') {
      mType = mType.symbol.declarations[0];
      retType = state.resolveType(mType);
    }

    // IF we have a winner, declare response type
    if (retType) {
      const type = {
        array: false,
        type: retType
      };
      if (ts.isArrayLiteralExpression(retType)) {
        type.array = true;
        type.type = retType.elements[0];
      }
      state.importDecorator(ENDPOINT_DEC_FILE, 'ResponseType');
      const produces = state.createDecorator('ResponseType', TransformUtil.fromLiteral({
        ...type,
        array: type.array,
        title: comments.return && comments.return.description
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

  static handleController(state: TransformerState, node: ts.ClassDeclaration) {
    // Read title/description/summary from jsdoc on class
    const comments = state.describeByComments(node);
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

export const transformers: NodeTransformer[] = [
  { type: 'class', before: RestTransformer.handleController, aliasName: 'rest-controller' },
  { type: 'method', before: RestTransformer.handleEndpoint, aliasName: 'rest-endpoint' },
];