import * as ts from 'typescript';
import { TransformUtil, TransformerState } from '@travetto/compiler';

const ENDPOINT_DECORATORS = {
  All: new Set(['@travetto/express']),
  Get: new Set(['@travetto/express']),
  Put: new Set(['@travetto/express']),
  Post: new Set(['@travetto/express']),
  Patch: new Set(['@travetto/express']),
  Delete: new Set(['@travetto/express']),
  Options: new Set(['@travetto/express']),
};

const CONTROLLER_DECORATORS = {
  Controller: new Set(['@travetto/express'])
};

const DECS = require.resolve('../src/decorator/config');

function defineType(state: TransformerState, type: ts.Expression) {
  const isArray = ts.isArrayLiteralExpression(type);
  const typeIdent = isArray ? (type as ts.ArrayLiteralExpression).elements[0] as ts.Expression : type as ts.Expression;
  const finalTarget = ts.isIdentifier(typeIdent) ? TransformUtil.importTypeIfExternal(state, typeIdent) : typeIdent;

  const res = {
    type: finalTarget,
    wrapper: isArray ? ts.createIdentifier('Array') : undefined,
  };

  return res;
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: TransformerState): T {
  if (ts.isMethodDeclaration(node) && (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) === 0) { // tslint:disable-line no-bitwise
    // Factory for static methods
    const foundDec = TransformUtil.findAnyDecorator(state, node, ENDPOINT_DECORATORS);
    const decls = node.decorators;

    const mNode = (node as ts.MethodDeclaration);

    if (foundDec) { // We have an endpoint
      const newDecls = [];

      const comments = TransformUtil.describeByComments(state, mNode);

      let retType = comments.return && comments.return.type;

      if (!retType && mNode.type) {
        let mType = mNode.type;
        if (ts.isTypeReferenceNode(mType) && mType.typeName.getText() === 'Promise') {
          mType = mType.typeArguments && mType.typeArguments.length ? mType.typeArguments[0] : mType;
        }
        if (mType.kind === ts.SyntaxKind.VoidKeyword) {
          retType = undefined;
        } else {
          retType = TransformUtil.resolveType(state, mType);
        }
      }

      if (retType) {
        const produces = TransformUtil.createDecorator(state, DECS, 'ResponseType', TransformUtil.fromLiteral({
          ...defineType(state, retType),
          title: comments.return && comments.return.description
        }));
        newDecls.push(produces);
      }

      if (comments.params) {
        for (const p of comments.params) {
          if (p.name === 'req.body' || p.name === 'req.query') {
            const dec = TransformUtil.createDecorator(state, DECS, 'RequestType', TransformUtil.fromLiteral({
              ...defineType(state, p.type!),
              title: p.description
            }));
            newDecls.push(dec);
          } else {
            const dec = TransformUtil.createDecorator(state, DECS, 'Param', TransformUtil.fromLiteral({
              description: p.description,
              name: p.name,
              required: !p.optional,
              ...defineType(state, p.type!)
            }));
            newDecls.push(dec);
          }
        }
      }

      if (comments.description) {
        newDecls.push(TransformUtil.createDecorator(state, DECS, 'Describe', TransformUtil.fromLiteral({
          title: comments.description,
        })));
      }

      if (newDecls.length) {
        const ret = ts.createMethod(
          [...decls!, ...newDecls],
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.questionToken,
          node.typeParameters,
          node.parameters,
          node.type,
          node.body
        ) as any;

        ret.parent = node.parent;

        return ret;
      }
    }
    return node;
  } else if (ts.isClassDeclaration(node)) {
    const foundDec = TransformUtil.findAnyDecorator(state, node, CONTROLLER_DECORATORS);
    if (foundDec) {
      const comments = TransformUtil.describeByComments(state, node);
      if (comments.description) {
        const decls = [...(node.decorators || [])];
        decls.push(TransformUtil.createDecorator(state, DECS, 'Describe', TransformUtil.fromLiteral({
          title: comments.description
        })));
        node = ts.updateClassDeclaration(
          node,
          ts.createNodeArray(decls),
          node.modifiers,
          node.name,
          node.typeParameters,
          node.heritageClauses,
          node.members
        ) as any;
      }
    }
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}

export const InjectableTransformer = {
  transformer: TransformUtil.importingVisitor<TransformerState>(() => ({}), visitNode),
  priority: 100,
  phase: 'before'
};