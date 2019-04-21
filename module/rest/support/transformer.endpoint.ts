import * as ts from 'typescript';

import { TransformUtil, TransformerState, Documentation, ParamDoc } from '@travetto/compiler';
import { ConfigSource } from '@travetto/config';
import { ParamConfig } from '../src/types';

const ENDPOINT_DECORATORS = {
  All: new Set(['@travetto/rest']),
  Get: new Set(['@travetto/rest']),
  Put: new Set(['@travetto/rest']),
  Post: new Set(['@travetto/rest']),
  Patch: new Set(['@travetto/rest']),
  Delete: new Set(['@travetto/rest']),
  Options: new Set(['@travetto/rest']),
};

const CONTROLLER_DECORATORS = {
  Controller: new Set(['@travetto/rest'])
};

const PARAM_DECORATORS = TransformUtil.buildImportAliasMap({
  ...ConfigSource.get('registry.rest-param'),
  '@travetto/rest': ['Path', 'Query', 'Header', 'Body', 'Context']
});

const ENDPOINT_DEC_FILE = require.resolve('../src/decorator/endpoint');
const PARAM_DEC_FILE = require.resolve('../src/decorator/param');
const COMMON_DEC_FILE = require.resolve('../src/decorator/common');

function defineType(state: TransformerState, type: ts.Expression | ts.TypeNode) {

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

  const finalTarget = !ts.isTypeNode(typeIdent) ? typeIdent : TransformUtil.resolveType(state, typeIdent);

  return { type: finalTarget, array: isArray };
}

function visitParameter(context: ts.TransformationContext, node: ts.ParameterDeclaration, state: TransformerState, comments: Documentation) {
  const typeName = node.type ? node.type.getText() : '';
  const pName = node.name.getText();

  let decConfig: ParamConfig = { name: pName } as any;
  let commentConfig: ParamDoc = {} as any;

  const pDec = TransformUtil.findAnyDecorator(state, node, PARAM_DECORATORS);
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

  const type = defineType(state, commentConfig.type! || node.type! || ts.createIdentifier('String'));

  if (typeName === 'Request' || typeName === 'Response') { // Convert to custom types
    type.type = ts.createPropertyAccess(TransformUtil.importFile(state, PARAM_DEC_FILE).ident, typeName.toUpperCase());
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

  if (!pDec) {
    // Handle body/request special as they are the input
    decs.push(TransformUtil.createDecorator(state, PARAM_DEC_FILE, 'Query',
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

function visitEndpoint(context: ts.TransformationContext, node: ts.MethodDeclaration, state: TransformerState) {

  const decls = node.decorators;
  const newDecls = [];

  // Process returnType

  const comments = TransformUtil.describeByComments(state, node);

  // Get return type from jsdoc comments
  let retType = comments.return && comments.return.type;

  // If comments empty, read from method node
  if (!retType && node.type) {
    let mType = node.type;
    if (ts.isTypeReferenceNode(mType) && mType.typeName.getText() === 'Promise') {
      mType = mType.typeArguments && mType.typeArguments.length ? mType.typeArguments[0] : mType;
    }
    if (mType.kind === ts.SyntaxKind.VoidKeyword) {
      retType = undefined;
    } else {
      retType = TransformUtil.resolveType(state, mType);
    }
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
    const produces = TransformUtil.createDecorator(state, ENDPOINT_DEC_FILE, 'ResponseType', TransformUtil.fromLiteral({
      ...type,
      array: type.array,
      title: comments.return && comments.return.description
    }));
    newDecls.push(produces);
  }

  // Handle description/title/summary w/e
  if (comments.description) {
    newDecls.push(TransformUtil.createDecorator(state, COMMON_DEC_FILE, 'Describe', TransformUtil.fromLiteral({
      title: comments.description,
    })));
  }

  let nParams = node.parameters;

  // Handle parameters
  if (node.parameters.length) {
    const params = [] as ts.ParameterDeclaration[];
    // If there are parameters to process
    for (const p of node.parameters) {
      params.push(visitParameter(context, p, state, comments));
    }

    nParams = ts.createNodeArray(params);
  }

  if (newDecls.length || nParams !== node.parameters) {
    const ret = ts.createMethod(
      [...decls!, ...newDecls],
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.questionToken,
      node.typeParameters,
      nParams,
      node.type,
      node.body
    ) as any;

    ret.parent = node.parent;

    return ret;
  } else {
    return node;
  }
}

function visitController(context: ts.TransformationContext, node: ts.ClassDeclaration, state: TransformerState) {
  // Read title/description/summary from jsdoc on class
  const comments = TransformUtil.describeByComments(state, node);
  if (comments.description) {
    const decls = [...(node.decorators || [])];
    decls.push(TransformUtil.createDecorator(state, COMMON_DEC_FILE, 'Describe', TransformUtil.fromLiteral({
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
    ) as any;
  } else {
    return node;
  }
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: TransformerState): T {
  if (ts.isMethodDeclaration(node) && (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) === 0) { // tslint:disable-line no-bitwise
    const foundDec = TransformUtil.findAnyDecorator(state, node, ENDPOINT_DECORATORS);

    // Endpoint exists
    if (foundDec) {
      return visitEndpoint(context, node as ts.MethodDeclaration, state);
    } else {
      return node;
    }
    // Document controller level information
  } else if (ts.isClassDeclaration(node)) {
    const foundDec = TransformUtil.findAnyDecorator(state, node, CONTROLLER_DECORATORS);
    if (foundDec) {
      node = visitController(context, node, state);
    }
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}

export const InjectableTransformer = {
  transformer: TransformUtil.importingVisitor<TransformerState>(() => ({}), visitNode),
  key: 'rest',
  after: 'di',
  phase: 'before'
};