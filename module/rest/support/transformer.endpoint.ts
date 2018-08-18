import { TransformUtil, TransformerState } from '@travetto/compiler';

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

const ENDPOINT_DEC_FILE = require.resolve('../src/decorator/endpoint');
const PARAM_DEC_FILE = require.resolve('../src/decorator/param');
const COMMON_DEC_FILE = require.resolve('../src/decorator/common');

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
    const foundDec = TransformUtil.findAnyDecorator(state, node, ENDPOINT_DECORATORS);
    const decls = node.decorators;

    const mNode = (node as ts.MethodDeclaration);

    // Endpoint exists
    if (foundDec) {
      const newDecls = [];

      // Process returnType

      const comments = TransformUtil.describeByComments(state, mNode);

      // Get return type from jsdoc comments
      let retType = comments.return && comments.return.type;

      // If comments empty, read from method node
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

      // IF we have a winner, declare response type
      if (retType) {
        const produces = TransformUtil.createDecorator(state, ENDPOINT_DEC_FILE, 'ResponseType', TransformUtil.fromLiteral({
          ...defineType(state, retType),
          title: comments.return && comments.return.description
        }));
        newDecls.push(produces);
      }

      // If there are parameters to process
      if (comments.params) {
        for (const p of comments.params) {
          // Handle body/request special as they are the input
          if (p.name === 'req.body' || p.name === 'req.query') {
            const dec = TransformUtil.createDecorator(state, ENDPOINT_DEC_FILE, 'RequestType', TransformUtil.fromLiteral({
              ...defineType(state, p.type!),
              title: p.description
            }));
            newDecls.push(dec);
          } else {
            // Handle as standard input param
            const dec = TransformUtil.createDecorator(state, PARAM_DEC_FILE, 'Param', TransformUtil.fromLiteral({
              description: p.description,
              name: p.name,
              required: !p.optional,
              ...defineType(state, p.type!)
            }));
            newDecls.push(dec);
          }
        }
      }

      // Handle description/title/summary w/e
      if (comments.description) {
        newDecls.push(TransformUtil.createDecorator(state, COMMON_DEC_FILE, 'Describe', TransformUtil.fromLiteral({
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

    // Document controller level information
  } else if (ts.isClassDeclaration(node)) {
    const foundDec = TransformUtil.findAnyDecorator(state, node, CONTROLLER_DECORATORS);
    if (foundDec) {
      // Read title/description/summary from jsdoc on class
      const comments = TransformUtil.describeByComments(state, node);
      if (comments.description) {
        const decls = [...(node.decorators || [])];
        decls.push(TransformUtil.createDecorator(state, COMMON_DEC_FILE, 'Describe', TransformUtil.fromLiteral({
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
  key: 'rest',
  after: 'di',
  phase: 'before'
};