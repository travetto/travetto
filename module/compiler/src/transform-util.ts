import { Compiler } from './compiler';
import * as ts from 'typescript';

export type Import = { path: string, ident: ts.Identifier };
export type DecList = ts.NodeArray<ts.Decorator>;

export class TransformUtil {
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


  static fromLiteral<T extends ts.Node>(val: T): T;
  static fromLiteral(val: undefined): ts.Identifier;
  static fromLiteral(val: null): ts.NullLiteral;
  static fromLiteral(val: object): ts.ObjectLiteralExpression;
  static fromLiteral(val: any[]): ts.ArrayLiteralExpression;
  static fromLiteral(val: string | boolean | number): ts.LiteralExpression;
  static fromLiteral(val: any) {
    if (val && val.kind) { // If already a node
      return val;
    } else if (Array.isArray(val)) {
      val = ts.createArrayLiteral(val.map(v => this.fromLiteral(v)));
    } else if (val === undefined) {
      val = ts.createIdentifier('undefined');
    } else if (val === null) {
      val = ts.createNull();
    } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      val = ts.createLiteral(val);
    } else {
      let pairs: ts.PropertyAssignment[] = [];
      for (let k of Object.keys(val)) {
        pairs.push(
          ts.createPropertyAssignment(k, this.fromLiteral(val[k]))
        );
      }
      return ts.createObjectLiteral(pairs);
    }
    return val;
  }

  static extendObjectLiteral(addTo: object, lit?: ts.ObjectLiteralExpression) {
    lit = lit || this.fromLiteral({});
    let props = lit.properties;
    let extra = this.fromLiteral(addTo).properties;
    return ts.updateObjectLiteral(lit, [...props, ...extra]);
  }

  static getPrimaryArgument<T>(node: ts.CallExpression | ts.Decorator | undefined): T | undefined {
    if (node && ts.isDecorator(node)) {
      node = node.expression as any as ts.CallExpression;
    }
    if (node && node!.arguments && node!.arguments.length) {
      return node.arguments[0] as any as T;
    }
    return;
  }

  static getObjectValue(node: ts.ObjectLiteralExpression | undefined, key: string) {
    if (node) {
      for (let prop of node.properties) {
        if (prop.name!.getText() === key) {
          return prop;
        }
      }
    }
    return undefined;
  }

  static getTypeInfoForNode(node: ts.Node) {
    let type = this.getTypeChecker().getTypeAtLocation(node);
    let decl = type!.symbol!.valueDeclaration!;
    let path = (decl as any).parent.fileName;
    let ident = (decl as any).name;
    return { path, ident, name: ident.text };
  }
}