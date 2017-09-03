import * as ts from 'typescript';
import { TransformUtil } from './transform-util';

function createStaticField(name: string, val: ts.Expression) {
  return ts.createProperty(
    undefined,
    [ts.createToken(ts.SyntaxKind.StaticKeyword)],
    name, undefined, undefined, val
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T): T {
  if (ts.isClassDeclaration(node)) {
    return ts.updateClassDeclaration(node,
      node.decorators,
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      ts.createNodeArray([
        createStaticField('__filename', ts.createIdentifier('__filename')),
        createStaticField('__id', ts.createBinary(
          ts.createIdentifier('__filename'),
          ts.SyntaxKind.PlusToken,
          ts.createBinary(
            ts.createLiteral('#'),
            ts.SyntaxKind.PlusToken,
            ts.createIdentifier(node.name!.getText())
          )
        )),

        ...node.members
      ])
    ) as any;
  }
  return ts.visitEachChild(node, c => visitNode(context, c), context);
}


export const ClassIdTransformer = {
  transformer: (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => visitNode(context, file),
  phase: 'before'
}