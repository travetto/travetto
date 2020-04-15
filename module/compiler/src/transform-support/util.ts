import * as ts from 'typescript';
import { resolve as pathResolve } from 'path';

import { RegisterUtil, FsUtil } from '@travetto/boot';
import { Env, Util } from '@travetto/base';

import { Documentation, Import } from './types/shared';

const exclude = new Set([
  'parent', 'checker', 'end', 'pos', 'id', 'source', 'sourceFile', 'getSourceFile',
  'statements', 'stringIndexInfo', 'numberIndexInfo', 'instantiations', 'thisType',
  'members', 'properties', 'outerTypeParameters', 'exports', 'transformFlags', 'flowNode',
  'nextContainer', 'modifierFlagsCache', 'declaredProperties'
]);

export class TransformUtil {

  static collapseNode(x: any, cache: Set<string> = new Set()): any {
    if (!x || Util.isPrimitive(x)) {
      return x;
    }

    if (cache.has(x)) {
      return;
    } else {
      cache.add(x);
    }

    if (Array.isArray(x)) {
      return x.map(v => this.collapseNode(v, cache));
    } else {
      const out: Record<string, any> = {};
      for (const key of Object.keys(x)) {
        if (Util.isFunction(x[key]) || exclude.has(key) || x[key] === undefined) {
          continue;
        }
        out[key] = this.collapseNode(x[key], cache);
      }
      return out;
    }
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
    } else if (val === String || val === Number || val === Boolean || val === Date || val === RegExp) {
      val = ts.createIdentifier(val.name);
    } else {
      const pairs: ts.PropertyAssignment[] = [];
      for (const k of Object.keys(val)) {
        if (val[k] !== undefined) {
          pairs.push(
            ts.createPropertyAssignment(k, this.fromLiteral(val[k]))
          );
        }
      }
      return ts.createObjectLiteral(pairs);
    }
    return val;
  }

  static toLiteral(val: ts.Node, strict = true): any {
    if (!val) {
      throw new Error('Val is not defined');
    } else if (ts.isArrayLiteralExpression(val)) {
      return val.elements.map(x => this.toLiteral(x, strict));
    } else if (ts.isIdentifier(val)) {
      if (val.getText() === 'undefined') {
        return undefined;
      } else if (!strict) {
        return val.getText();
      }
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
      const out: Record<string, any> = {};
      for (const pair of val.properties) {
        if (ts.isPropertyAssignment(pair)) {
          out[pair.name.getText()] = this.toLiteral(pair.initializer, strict);
        }
      }
      return out;
    }
    throw new Error(`Not a valid input, should be a valid ts.Node: ${val.kind}`);
  }

  static extendObjectLiteral(addTo: object, lit?: ts.ObjectLiteralExpression) {
    lit = lit ?? this.fromLiteral({});
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

  static getObjectValue(node: ts.Expression | undefined, key: string) {
    if (node && ts.isObjectLiteralExpression(node) && node.properties) {
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

  /*
   * useful for handling failed imports, but still transpiling
   */
  static optionalResolve(file: string, base?: string) {
    file = base ? pathResolve(base, file) : file;
    try {
      return require.resolve(file);
    } catch {
      return file;
    }
  }

  static createStaticField(name: string, val: ts.Expression | string | number): ts.PropertyDeclaration {
    return ts.createProperty(
      undefined,
      [ts.createToken(ts.SyntaxKind.StaticKeyword)],
      name, undefined, undefined, ['string', 'number'].includes(typeof val) ? ts.createLiteral(val as any) : val as ts.Expression
    );
  }

  static createDecorator(name: ts.Expression, ...contents: (ts.Expression | undefined)[]) {
    return ts.createDecorator(
      ts.createCall(
        name,
        undefined,
        contents.filter(x => !!x) as ts.Expression[]
      )
    );
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

  static getSymbol(type: ts.Type | ts.Symbol) {
    return 'valueDeclaration' in type ? type : (type.aliasSymbol ?? type.symbol);
  }

  static getSymbolName(type: ts.Type | ts.Symbol): string | undefined {
    return this.getSymbol(type)?.getName() || undefined;
  }

  static getDeclarations(type: ts.Type | ts.Symbol | ts.Declaration[]): ts.Declaration[] {
    let decls: ts.Declaration[] = [];
    if (Array.isArray(type)) {
      decls = type;
    } else {
      decls = this.getSymbol(type)?.getDeclarations?.() ?? [];
    }
    return decls.filter(x => !!x);
  }

  static getPrimaryDeclaration(decls: ts.Declaration[]): ts.Declaration {
    return decls?.[0];
  }

  static readJSDocs(type: ts.Type | ts.Node) {
    let node = 'getSourceFile' in type ? type : this.getPrimaryDeclaration(this.getDeclarations(type));

    const out: Documentation = {
      description: undefined,
      return: undefined,
      params: []
    };

    if (node) {
      const tags = ts.getJSDocTags(node);
      while (!('jsDoc' in node) && 'original' in node && (node as any).original) {
        node = (node as any).original as ts.Node;
      }

      const docs = (node as any)['jsDoc'];

      if (docs) {
        const top = docs[docs.length - 1];
        if (ts.isJSDoc(top)) {
          out.description = top.comment;
        }
      }

      if (tags && tags.length) {
        for (const tag of tags) {
          if (ts.isJSDocReturnTag(tag)) {
            out.return = tag.comment;
          } else if (ts.isJSDocParameterTag(tag)) {
            out.params!.push({
              name: tag.name && tag.name.getText(),
              description: tag.comment ?? ''
            });
          }
        }
      }
    }
    return out;
  }

  static readJSDocTags(type: ts.Type, name: string) {
    const tags = this.getSymbol(type)?.getJsDocTags() ?? [];
    return tags
      .filter(el => el.name === name)
      .map(el => el.text!);
  }

  static collectImports(src: ts.SourceFile) {
    const pth = require.resolve(src.fileName);
    const base = FsUtil.resolveNative(pth);

    const imports = new Map<string, Import>();

    for (const stmt of src.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        let path = this.optionalResolve(stmt.moduleSpecifier.text, base);

        path = RegisterUtil.resolveForFramework(path); // @TRV_DEV

        if (stmt.importClause) {
          if (stmt.importClause.namedBindings) {
            const bindings = stmt.importClause.namedBindings;
            if (ts.isNamespaceImport(bindings)) {
              imports.set(bindings.name.text, { path, ident: bindings.name, stmt });
            } else if (ts.isNamedImports(bindings)) {
              for (const n of bindings.elements) {
                imports.set(n.name.text, { path, ident: n.name, stmt });
              }
            }
          }
        }
      }
    }

    return imports;
  }

  public static addImports(file: ts.SourceFile, ...imports: Import[]) {
    if (!imports.length) {
      return file;
    }

    try {
      const importStmts = imports.map(({ path, ident }) => {
        const imptStmt = ts.createImportDeclaration(
          undefined, undefined,
          ts.createImportClause(undefined, ts.createNamespaceImport(ident)),
          ts.createLiteral(require.resolve(path).replace(/^.*node_modules.*@travetto/, '@travetto'))
        );
        return imptStmt;
      });

      const out = ts.updateSourceFileNode(file,
        ts.createNodeArray([
          ...importStmts,
          ...file.statements.filter(x => !(x as any).remove) // Exclude culled imports
        ]),
        file.isDeclarationFile, file.referencedFiles,
        file.typeReferenceDirectives, file.hasNoDefaultLib);

      return out;
    } catch (err) { // Missing import
      if (file.fileName.includes('/extension/')) {
        return file; // Swallow missing extensions
      } else {
        const out = new Error(`${err.message} in ${file.fileName.replace(`${Env.cwd}/`, '')}`);
        out.stack = err.stack;
        throw out;
      }
    }
  }

  static spliceDecorators(node: { decorators?: ts.MethodDeclaration['decorators'] }, target: ts.Decorator | undefined, replacements: ts.Decorator[], idx = -1) {
    const out = (node.decorators ?? []).filter(x => x !== target);
    out.splice(idx, 0, ...replacements);
    return out;
  }

  /**
   * Searches upward from the node until it finds the variable declaration list,
   * and then checks the toString for `const `
   */
  static isConstantDeclaration(node: ts.Node) {
    let s: ts.Node = node;
    while (s && !ts.isVariableDeclarationList(s)) {
      s = s.parent;
    }
    return s?.getText().startsWith('const '); // Cheap out on check, ts is being weird
  }

  static resolveConcreteType(type: ts.Type) {
    const tags = TransformUtil.readJSDocTags(type, 'concrete');
    if (tags.length) {
      const parts = tags[0].split(':');
      const fileName = this.getPrimaryDeclaration(this.getDeclarations(type))?.getSourceFile().fileName;
      if (parts.length === 1) {
        parts.unshift('.');
      }
      return { name: parts[1], source: FsUtil.resolveUnix(fileName, parts[0]) };
    }
  }
}