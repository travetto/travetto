import * as ts from 'typescript';
import { Compiler } from '@encore/base/src/lib/compiler';
import { Injectable } from './injectable';

type DecList = ts.NodeArray<ts.Decorator>;
type SchemaList = (ts.Expression | undefined)[];

interface State {
  ident: ts.Identifier,
  injected: boolean;
  declared: ts.Identifier[]
}

const b = <T extends ts.Node>(n: T) => ts.setTextRange(n, { pos: 0, end: 0 });

export const Transformer =
  (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => {
      let ident = b(ts.createUniqueName('injectable'));
      let state: State = { declared: [], injected: false, ident };
      let ret = visitNode(context, file, state);

      if (state.injected) {

        let imptStmt = b(ts.createImportDeclaration(
          undefined, undefined,
          b(ts.createImportClause(undefined, b(ts.createNamespaceImport(ident)))),
          b(ts.createLiteral(require.resolve('./injectable')))
        ));

        imptStmt.parent = file;

        ret.statements = ts.createNodeArray([
          imptStmt,
          ...ret.statements
        ]);
      }
      return ret;
    };

function getDecoratorIdent(d: ts.Decorator): ts.Identifier {
  if (ts.isCallExpression(d.expression)) {
    return d.expression.expression as ts.Identifier;
  } else if (ts.isIdentifier(d.expression)) {
    return d.expression;
  } else {
    throw new Error('No Identifier');
  }
}

function getDecorators(node: ts.ClassDeclaration): ts.Decorator | undefined {
  let decs = (node.decorators || [] as any as DecList).filter(d => !!d.expression);
  if (decs && decs.length) {
    let inject: ts.Decorator = decs
      .filter(d => {
        let type = Compiler.getTypeChecker().getTypeAtLocation(getDecoratorIdent(d));
        if (type.symbol) {
          let name = Compiler.getTypeChecker().getFullyQualifiedName(type.symbol!);
          return name === `"${require.resolve('./injectable').replace(/\.ts$/, '')}".${Injectable.name}`;
        } else {
          return false;
        }
      })[0];

    return inject;
  }
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: State): T {
  if (ts.isClassDeclaration(node)) {
    let dec = getDecorators(node);
    let cons;
    for (let member of node.members) {
      if (ts.isConstructorDeclaration(member)) {
        cons = member;
        break;
      }
    }

    let ret = ts.visitEachChild(node, c => visitNode(context, c, state), context);

    if (cons) {
      let newDec = b(ts.createDecorator(
        b(ts.createCall(
          b(ts.createPropertyAccess(state.ident, 'InjectParams')),
          undefined,
          [
            ts.createArrayLiteral(
              cons.parameters.map(x => {
                return (Compiler.getTypeChecker().getTypeAtLocation(x)!.symbol!.getDeclarations()![0] as any).name;
              })
            )
          ]
        ))
      ));
      state.injected = true;
      ret = b(ts.updateClassDeclaration(ret,
        ts.createNodeArray([newDec, ...node.decorators!]),
        node.modifiers, node.name,
        node.typeParameters,
        node.heritageClauses as any, node.members
      ) as any);
    }
    return ret;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

