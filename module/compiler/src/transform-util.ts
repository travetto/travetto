import { Compiler } from './compiler';
import * as ts from 'typescript';

export type Import = { path: string, ident: ts.Identifier };
export type DecList = ts.NodeArray<ts.Decorator>;
export interface State {
  imports: Import[],
  path: string
}

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

  static findAnyDecorator(node: ts.Node, patterns: { [key: string]: Set<string> }): ts.Decorator | undefined {
    for (let dec of (node.decorators || []) as any as DecList) {
      let ident = this.getDecoratorIdent(dec);
      if (ident && ident.text in patterns) {
        let { path } = this.getTypeInfoForNode(ident);
        if (patterns[ident.text].has(path)) {
          return dec;
        }
      }
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
    if (node && node.properties) {
      for (let prop of node.properties) {
        if (prop.name!.getText() === key) {
          if (ts.isPropertyAssignment(prop)) {
            return prop.initializer;
          } else if (ts.isShorthandPropertyAssignment(prop)) {
            return prop.name;
          }
        }
      }
    }
    return undefined;
  }

  static getTypeInfoForNode(node: ts.Node) {
    let type = this.getTypeChecker().getTypeAtLocation(node);
    if (type.symbol) {
      let decl = type!.symbol!.valueDeclaration!;
      let path = (decl as any).parent.fileName;
      let ident = (decl as any).name;
      return { path, ident, name: ident.text };
    } else {
      throw new Error('Type information not found');
    }
  }

  static importingVisitor<T extends State>(
    init: () => Partial<T>,
    visitor: <Z extends ts.Node>(context: ts.TransformationContext, node: Z, state: T) => Z
  ) {
    return (context: ts.TransformationContext) =>
      (file: ts.SourceFile) => {
        let state = init() as T;
        state.path = require.resolve(file.fileName);
        state.imports = [];
        try {
          let ret = visitor(context, file, state);

          if (state.imports.length) {
            this.addImport(ret, state.imports);
          }
          return ret;
        } catch (e) {
          console.log(file.fileName);
          console.log(e);
          throw e;
        }
      };
  }

  static importIfExternal<T extends State>(node: ts.Node, state: State) {
    let { path, name: declName, ident: decl } = this.getTypeInfoForNode(node);
    let ident = ts.createIdentifier(declName);
    let importName = ts.createUniqueName(`import_${declName}`);

    let finalTarget: ts.Expression = ident;

    if (require.resolve(path) !== state.path) {
      state.imports.push({
        ident: importName,
        path
      });

      finalTarget = ts.createPropertyAccess(importName, ident);
    }
    return finalTarget;
  }
}