import { Compiler } from './compiler';
import * as ts from 'typescript';

export type Import = { path: string, ident: ts.Identifier };
export type DecList = ts.NodeArray<ts.Decorator>;

export class TransformUtils {
  static getTypeChecker() {
    return Compiler.services.getProgram().getTypeChecker();
  }

  static getDecoratorIdent(d: ts.Decorator): ts.Identifier {
    if (ts.isCallExpression(d.expression)) {
      return d.expression.expression as ts.Identifier;
    } else if (ts.isIdentifier(d.expression)) {
      return d.expression;
    } else {
      throw new Error('No Identifier');
    }
  }

  static getDecorator(node: ts.Node, file: string, className: string | { name: string }): ts.Decorator | undefined {
    let decs = (node.decorators || [] as any as DecList).filter(d => !!d.expression);
    if (decs && decs.length) {
      let inject: ts.Decorator = decs
        .filter(d => {
          let type = this.getTypeChecker().getTypeAtLocation(this.getDecoratorIdent(d));
          if (type.symbol) {
            let name = this.getTypeChecker().getFullyQualifiedName(type.symbol!);
            return name === `"${file.replace(/\.ts$/, '')}".${typeof className === 'string' ? className : className.name}`;
          } else {
            return false;
          }
        })[0];

      return inject;
    }
  }

  static addImport(file: ts.SourceFile, imports: { path: string, ident: ts.Identifier }[]) {
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

    return file;
  }
}