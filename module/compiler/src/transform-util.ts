import * as ts from 'typescript';
import { dirname, } from 'path';

import { AppInfo, FsUtil, Util } from '@travetto/base';

export type Import = { path: string, ident: ts.Identifier };
export type DecList = ts.NodeArray<ts.Decorator>;
export interface TransformerState {
  source: ts.SourceFile;
  newImports: Map<string, Import>;
  path: string;
  modulePath: string;
  decorators: Map<string, ts.PropertyAccessExpression>;
  imports: Map<string, Import>;
  ids: Map<String, number>;
}

export class TransformUtil {

  static generateUniqueId(state: TransformerState, name: string) {
    const val = (state.ids.get(name) || 0) + 1;
    state.ids.set(name, val);
    return ts.createIdentifier(`${name}_${val}`);
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

  static findAnyDecorator(state: TransformerState, node: ts.Node, patterns: { [key: string]: Set<string> }): ts.Decorator | undefined {
    for (const dec of (node.decorators || []) as any as DecList) {
      const ident = this.getDecoratorIdent(dec);
      if (!ts.isIdentifier(ident)) {
        continue;
      }
      if (ident && ident.escapedText in patterns) {
        let { path } = state.imports.get(ident.escapedText! as string)!;
        const packages = patterns[ident.escapedText as string];
        path = FsUtil.toUnix(path);

        if (path.includes('@travetto') || (!path.includes('node_modules') && AppInfo.PACKAGE === '@travetto')) {
          let pkg = '';
          if (!path.includes('node_modules')) {
            pkg = AppInfo.NAME;
          } else {
            pkg = `@travetto/${path.split(/@travetto[\/]/)[1].split(/[\/]/)[0]}`;
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
        return imptStmt;
      });

    const out = ts.updateSourceFileNode(file, ts.createNodeArray([
      ...importStmts,
      ...file.statements
    ]),
      file.isDeclarationFile, file.referencedFiles,
      file.typeReferenceDirectives, file.hasNoDefaultLib);

    return out;
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

  static toLiteral(val: ts.Node): any {
    if (!val) {
      throw new Error('Val is not defined');
    } else if (ts.isArrayLiteralExpression(val)) {
      return val.elements.map(x => this.toLiteral(x));
    } else if (ts.isIdentifier(val) && val.getText() === 'undefined') {
      return undefined;
    } else if (val.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    } else if (ts.isStringLiteral(val)) {
      return val.getText().substring(1, val.getText().length - 1);
    } else if (ts.isNumericLiteral(val)) {
      const txt = val.getText();
      if (txt.includes('.')) {
        return parseFloat(txt);
      } else {
        return parseInt(txt, 10);
      }
    } else if (val.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    } else if (val.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    } else if (ts.isObjectLiteralExpression(val)) {
      const out: { [key: string]: any } = {};
      for (const pair of val.properties) {
        if (ts.isPropertyAssignment(pair)) {
          out[pair.name.getText()] = this.toLiteral(pair.initializer);
        }
      }
      return out;
    }
    throw new Error('Not a valid input, should be a valid ts.Node');
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

  static importingVisitor<T extends TransformerState>(
    init: (file: ts.SourceFile, context?: ts.TransformationContext) => Partial<T>,
    visitor: <Z extends ts.Node>(context: ts.TransformationContext, node: Z, state: T) => Z
  ) {
    return (context: ts.TransformationContext) =>
      (file: ts.SourceFile) => {

        const pth = require.resolve(file.fileName);
        const state = {
          ...init(file, context) as any,
          path: FsUtil.resolveNative(pth),
          modulePath: FsUtil.resolveUnix(pth),
          newImports: new Map(),
          source: file,
          ids: new Map(),
          imports: new Map(),
          decorators: new Map()
        } as T;

        for (const stmt of file.statements) {
          if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
            let path = require.resolve(stmt.moduleSpecifier.text
              .replace(/^\.\./, dirname(dirname(state.path)))
              .replace(/^\.\//, `${dirname(state.path)}/`));

            if (process.env.TRV_FRAMEWORK_DEV) {
              path = FsUtil.resolveFrameworkDevFile(path);
            }

            if (stmt.importClause) {
              if (stmt.importClause.namedBindings) {
                const bindings = stmt.importClause.namedBindings;
                if (ts.isNamespaceImport(bindings)) {
                  state.imports.set(bindings.name.text, { path, ident: bindings.name });
                } else if (ts.isNamedImports(bindings)) {
                  for (const n of bindings.elements) {
                    state.imports.set(n.name.text, { path, ident: n.name });
                  }
                }
              }
            }
          }
        }

        let ret = visitor(context, file, state);

        if (state.newImports.size) {
          ret = this.addImport(ret, Array.from(state.newImports.values()));
        }

        for (const el of ret.statements) {
          if (!el.parent) {
            el.parent = ret;
          }
        }

        return ret;
      };
  }

  static importTypeIfExternal<T extends TransformerState>(state: TransformerState, typeNode: ts.TypeNode | ts.Identifier) {
    //    let { path, name: declName, ident: decl } = this.getTypeInfoForNode(node);

    const nodeName = ts.isTypeNode(typeNode) ?
      (typeNode as ts.TypeReferenceNode).typeName.getText() :
      ((typeNode as ts.Identifier).text || (typeNode as ts.Identifier).escapedText as string);

    if (nodeName.match(/^[A-Z]{1,2}$/)) {
      throw new Error('Type information not found');
    }

    if (nodeName.indexOf('.') > 0) {
      const [importName, ident] = nodeName.split('.');

      if (state.imports.has(importName)) {
        const pth = state.imports.get(importName)!.path;
        const importIdent = this.importFile(state, pth).ident;
        return ts.createPropertyAccess(importIdent, ident);
      }
      return ts.createPropertyAccess(ts.createIdentifier(importName), ident);
    } else {
      const ident = nodeName;
      // External
      if (state.imports.has(nodeName)) {
        const pth = state.imports.get(nodeName)!.path;
        const importName = this.importFile(state, pth).ident;
        return ts.createPropertyAccess(importName, ident);
      } else {
        return ts.createIdentifier(nodeName);
      }
    }
  }

  static buildImportAliasMap(pathToType: { [key: string]: string | string[] } = {}) {
    const out: { [key: string]: Set<string> } = {};

    for (const [k, v] of Object.entries(pathToType)) {
      const ls = Array.isArray(v) ? v : [v];
      for (const lsi of ls) {
        if (!(lsi in out)) {
          out[lsi] = new Set();
        }
        out[lsi].add(k);
      }
    }

    return out;
  }

  static importFile(state: TransformerState, pth: string) {
    if (!state.newImports.has(pth)) {
      const ident = ts.createIdentifier(`i_${Util.naiveHash(pth)}`);
      const imprt = {
        path: pth,
        ident
      };
      state.imports.set(ident.escapedText.toString(), imprt);
      state.newImports.set(pth, imprt);
    }
    return state.newImports.get(pth)!;
  }

  static createDecorator(state: TransformerState, pth: string, name: string, ...contents: (ts.Expression | undefined)[]) {
    if (!state.decorators.has(name)) {
      const ref = this.importFile(state, pth);
      const ident = ts.createIdentifier(name);
      state.decorators.set(name, ts.createPropertyAccess(ref.ident, ident));
    }

    return ts.createDecorator(
      ts.createCall(
        state.decorators.get(name)!,
        undefined,
        contents.filter(x => !!x) as ts.Expression[]
      )
    );
  }

  static createStaticField(name: string, val: ts.Expression | string | number) {
    return ts.createProperty(
      undefined,
      [ts.createToken(ts.SyntaxKind.StaticKeyword)],
      name, undefined, undefined, ['string', 'number'].includes(typeof val) ? ts.createLiteral(val as any) : val as ts.Expression
    );
  }

  static resolveType(state: TransformerState, type: ts.Node): ts.Expression {
    let expr: ts.Expression | undefined;
    const kind = type && type!.kind;

    switch (kind) {
      case ts.SyntaxKind.TypeReference:
        expr = TransformUtil.importTypeIfExternal(state, type as ts.TypeReferenceNode);
        break;
      case ts.SyntaxKind.VoidKeyword: expr = ts.createIdentifier('undefined'); break;
      case ts.SyntaxKind.LiteralType: expr = this.resolveType(state, (type as any as ts.LiteralTypeNode).literal); break;
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.StringKeyword: expr = ts.createIdentifier('String'); break;
      case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.NumberKeyword: expr = ts.createIdentifier('Number'); break;
      case ts.SyntaxKind.TrueKeyword:
      case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.BooleanKeyword: expr = ts.createIdentifier('Boolean'); break;
      case ts.SyntaxKind.ArrayType:
        expr = ts.createArrayLiteral([this.resolveType(state, (type as ts.ArrayTypeNode).elementType)]);
        break;
      case ts.SyntaxKind.TypeLiteral:
        const properties: ts.PropertyAssignment[] = [];
        for (const member of (type as ts.TypeLiteralNode).members) {
          let subMember: ts.TypeNode = (member as any).type;
          if ((subMember as any).literal) {
            subMember = (subMember as any).literal;
          }
          properties.push(ts.createPropertyAssignment(member.name as ts.Identifier, this.resolveType(state, subMember)));
        }
        expr = ts.createObjectLiteral(properties);
        break;
      case ts.SyntaxKind.UnionType: {
        const types = (type as ts.UnionTypeNode).types;
        expr = types.slice(1).reduce((fType, stype) => {
          const fTypeStr = (fType as any).text;
          if (fTypeStr !== 'Object') {
            const resolved = this.resolveType(state, stype);
            if ((resolved as any).text !== fTypeStr) {
              fType = ts.createIdentifier('Object');
            }
          }
          return fType;
        }, this.resolveType(state, types[0]));
        break;
      }
      case ts.SyntaxKind.ObjectKeyword:
      default:
        break;
    }
    return expr || ts.createIdentifier('Object');
  }

  static describeByComments(state: TransformerState, node: ts.Node) {
    while ('original' in node) {
      node = (node as any).original as ts.Node;
    }
    const tags = ts.getJSDocTags(node);
    const docs = (node as any)['jsDoc'];

    const out: Documentation = {
      description: undefined,
      return: undefined,
      params: []
    };

    if (docs) {
      const top = docs[docs.length - 1];
      if (ts.isJSDoc(top)) {
        out.description = top.comment;
      }
    }

    if (tags && tags.length) {
      for (const tag of tags) {
        if (ts.isJSDocReturnTag(tag)) {
          out.return = {
            type: tag.typeExpression && this.resolveType(state, tag.typeExpression.type),
            description: tag.comment
          };
        } else if (ts.isJSDocParameterTag(tag)) {
          out.params!.push({
            name: tag.name && tag.name.getText(),
            description: tag.comment || '',
            type: tag.typeExpression && this.resolveType(state, tag.typeExpression.type),
            optional: tag.isBracketed
          });
        }
      }
    }

    return out;
  }
}

interface Documentation {
  return?: { description?: string; type?: ts.Expression };
  description?: string;
  params?: { name: string, description: string, optional?: boolean, type?: ts.Expression }[];
}