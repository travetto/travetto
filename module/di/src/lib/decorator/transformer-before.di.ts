import * as ts from 'typescript';
import { Compiler } from '@encore/base/src/lib/compiler';

type DecList = ts.NodeArray<ts.Decorator>;
type SchemaList = (ts.Expression | undefined)[];

type Import = { path: string, ident: ts.Identifier };

interface State {
  imports: Import[],
  path: string
}

export const Transformer =
  (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => {
      let state: State = { imports: [], path: require.resolve(file.fileName) };
      let ret = visitNode(context, file, state);

      if (state.imports.length) {
        addImport(ret, state.imports);
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

function getDecorator(node: ts.Node, file: string, className: string | { name: string }): ts.Decorator | undefined {
  let decs = (node.decorators || [] as any as DecList).filter(d => !!d.expression);
  if (decs && decs.length) {
    let inject: ts.Decorator = decs
      .filter(d => {
        let type = Compiler.getTypeChecker().getTypeAtLocation(getDecoratorIdent(d));
        if (type.symbol) {
          let name = Compiler.getTypeChecker().getFullyQualifiedName(type.symbol!);
          return name === `"${require.resolve(file).replace(/\.ts$/, '')}".${typeof className === 'string' ? className : className.name}`;
        } else {
          return false;
        }
      })[0];

    return inject;
  }
}

function addImport(file: ts.SourceFile, imports: { path: string, ident: ts.Identifier }[]) {
  let importStmts = imports
    .map(({ path, ident }) => {
      let imptStmt = ts.createImportDeclaration(
        undefined, undefined,
        ts.createImportClause(undefined, ts.createNamespaceImport(ident)),
        ts.createLiteral(require.resolve(path))
      );

      imptStmt.parent = file;
      return imptStmt;
    });

  file.statements = ts.createNodeArray([
    ...importStmts,
    ...file.statements
  ]);
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: State): T {
  if (ts.isClassDeclaration(node)) {
    let foundDec = getDecorator(node, './injectable', 'Injectable');
    let cons;
    for (let member of node.members) {
      if (ts.isConstructorDeclaration(member)) {
        cons = member;
        break;
      }
    }

    let ret = ts.visitEachChild(node, c => visitNode(context, c, state), context);

    if (cons) {
      let dec = foundDec!;
      let expr = (dec.expression as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
      if (!expr) {
        expr = ts.createObjectLiteral([]);
      }
      let props = [
        ...expr.properties,
        ts.createPropertyAssignment(
          ts.createLiteral('dependencies'),
          ts.createArrayLiteral(
            (cons.parameters! || []).map(x => {
              let name = getDecorator(x, './injectable', 'Inject');
              let type = Compiler.getTypeChecker().getTypeAtLocation(x);
              let decl = type!.symbol!.valueDeclaration!;
              let path = (decl as any).parent.fileName;
              let ident = ts.createIdentifier(`${(decl as any).name.text}`);
              let importName = ts.createUniqueName(`import_${(decl as any).name.text}`);

              if (require.resolve(path) !== state.path) {
                state.imports.push({
                  ident: importName,
                  path
                });

                let obj = ts.createObjectLiteral([
                  ts.createPropertyAssignment('type', ts.createPropertyAccess(importName, ident)),
                  ts.createPropertyAssignment('name', name ? (name.expression as ts.CallExpression).arguments[0] : ts.createIdentifier('undefined'))
                ]);
                return obj;
              } else {
                let obj = ts.createObjectLiteral([
                  ts.createPropertyAssignment('type', (decl as any).name),
                ]);
                return obj;
              }
            })
          )
        )
      ];

      dec = ts.updateDecorator(dec, ts.updateCall(
        (dec.expression as ts.CallExpression),
        (dec.expression as ts.CallExpression).expression,
        undefined,
        [ts.updateObjectLiteral(expr!, props)]
      ))

      ret = ts.updateClassDeclaration(ret,
        [dec, ...(ret.decorators! || []).filter(x => x !== foundDec)],
        ret.modifiers, ret.name,
        ret.typeParameters,
        ret.heritageClauses as any,
        ret.members) as any;
    }

    return ret;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

