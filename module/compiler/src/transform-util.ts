import * as ts from 'typescript';
import { dirname } from 'path';
import { AppEnv, AppInfo } from '@travetto/base';

export type Import = { path: string, ident: ts.Identifier };
export type DecList = ts.NodeArray<ts.Decorator>;
export interface State {
  newImports: Import[];
  path: string;
  imports: Map<string, Import>;
}

export class TransformUtil {
  /*
  static getTypeChecker() {
    return Compiler.langaugeService.getProgram().getTypeChecker();
  }

  static getTypeInfoForNode(node: ts.Node) {
    let type = this.getTypeChecker().getTypeAtLocation(node);
    if (type.symbol && type.symbol.valueDeclaration) {
      let decl = type!.symbol!.valueDeclaration!;
      let path = (decl as any).parent.fileName;
      let ident = (decl as any).name;
      return { path, ident, name: ident.text };
    } else {
      throw new Error('Type information not found');
    }
  }
  */

  static getDecoratorIdent(d: ts.Decorator): ts.Identifier {
    if (ts.isCallExpression(d.expression)) {
      return d.expression.expression as ts.Identifier;
    } else if (ts.isIdentifier(d.expression)) {
      return d.expression;
    } else {
      throw new Error('No Identifier');
    }
  }

  static findAnyDecorator(node: ts.Node, patterns: { [key: string]: Set<string> }, state: State): ts.Decorator | undefined {
    for (const dec of (node.decorators || []) as any as DecList) {
      const ident = this.getDecoratorIdent(dec);
      if (!ts.isIdentifier(ident)) {
        continue;
      }
      if (ident && ident.escapedText in patterns) {
        const { path } = state.imports.get(ident.escapedText! as string)!;
        const packages = patterns[ident.escapedText as string];
        if (path.includes('@travetto') || (!path.includes('node_modules') && AppInfo.PACKAGE === '@travetto')) {
          let pkg = '';
          if (!path.includes('node_modules')) {
            pkg = AppInfo.NAME;
          } else {
            pkg = `@travetto/${path.split(/@travetto\//)[1].split('/')[0]}`;
          }
          if (packages.has(pkg)) {
            return dec;
          }
        }
      }
    }
  }

  static addImport(file: ts.SourceFile, imports: Import[]) {
    const importStmts = imports
      .map(({ path, ident }) => {
        const imptStmt = ts.createImportDeclaration(
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
      const pairs: ts.PropertyAssignment[] = [];
      for (const k of Object.keys(val)) {
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
    const props = lit.properties;
    const extra = this.fromLiteral(addTo).properties;
    return ts.updateObjectLiteral(lit, [...props, ...extra]);
  }

  static getPrimaryArgument<T = ts.Node>(node: ts.CallExpression | ts.Decorator | undefined): T | undefined {
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
      for (const prop of node.properties) {
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

  static importingVisitor<T extends State>(
    init: (file: ts.SourceFile, context?: ts.TransformationContext) => Partial<T>,
    visitor: <Z extends ts.Node>(context: ts.TransformationContext, node: Z, state: T) => Z
  ) {
    return (context: ts.TransformationContext) =>
      (file: ts.SourceFile) => {
        const state = init(file, context) as T;
        state.path = require.resolve(file.fileName);
        state.newImports = [];
        state.imports = new Map();

        for (const stmt of file.statements) {
          if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
            let path = '';
            stmt.importClause!;
            path = require.resolve(stmt.moduleSpecifier.text
              .replace(/^\.\./, dirname(dirname(state.path)))
              .replace(/^\.\//, `${dirname(state.path)}/`));
            if (stmt.importClause) {
              if (stmt.importClause.namedBindings) {
                const bindings = stmt.importClause.namedBindings;
                if (ts.isNamespaceImport(bindings)) {
                  state.imports.set(bindings.name.text, { path, ident: bindings.name })
                } else if (ts.isNamedImports(bindings)) {
                  for (const n of bindings.elements) {
                    state.imports.set(n.name.text, { path, ident: n.name })
                  }
                }
              }
            }
          }
        }

        const ret = visitor(context, file, state);

        if (state.newImports.length) {
          this.addImport(ret, state.newImports);
        }
        return ret;
      };
  }

  static importIfExternal<T extends State>(typeNode: ts.TypeNode, state: State) {
    //    let { path, name: declName, ident: decl } = this.getTypeInfoForNode(node);

    const nodeName = (typeNode as any).typeName!.getText();
    if (nodeName.match(/^[A-Z]{1,3}$/)) {
      throw new Error('Type information not found');
    }

    if (nodeName.indexOf('.') > 0) {
      const [importName, ident] = nodeName.split('.');
      if (state.imports.has(importName)) {
        const importIdent = ts.createUniqueName(`import_${importName}`);

        state.newImports.push({
          ident: importIdent,
          path: state.imports.get(importName)!.path
        });

        return ts.createPropertyAccess(importIdent, ident);
      }
      return ts.createPropertyAccess(ts.createIdentifier(importName), ident);
    } else {
      const ident = nodeName;
      // External
      if (state.imports.has(nodeName)) {
        const importName = ts.createUniqueName(`import_${nodeName}`);

        state.newImports.push({
          ident: importName,
          path: state.imports.get(nodeName)!.path
        });

        return ts.createPropertyAccess(importName, ident);
      }
      return ts.createIdentifier(nodeName);
    }
  }

  static buildImportAliasMap(pathToType: { [key: string]: string } = {}) {
    const out: { [key: string]: Set<string> } = {};

    for (const [k, v] of Object.entries(pathToType)) {
      if (!(v in out)) {
        out[v] = new Set();
      }
      out[v].add(k);
    }

    return out;
  }
}