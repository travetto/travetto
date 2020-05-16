import * as ts from 'typescript';
import { resolve as pathResolve, dirname } from 'path';

import { FsUtil } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';

import { Env, Util } from '@travetto/base';

import { DeclDocumentation, Import } from './types/shared';

const exclude = new Set([
  'parent', 'checker', 'end', 'pos', 'id', 'source', 'sourceFile', 'getSourceFile',
  'statements', 'stringIndexInfo', 'numberIndexInfo', 'instantiations', 'thisType',
  'members', 'properties', 'outerTypeParameters', 'exports', 'transformFlags', 'flowNode',
  'nextContainer', 'modifierFlagsCache', 'declaredProperties'
]);

/**
 * Transformation util
 */
export class TransformUtil {

  /**
   * See if inbound node has an original property
   */
  static hasOriginal(o: ts.Node): o is (ts.Node & { original: ts.Node }) {
    return 'original' in o && !!o['original'];
  }

  /**
   * See if node has js docs
   */
  static hasJSDoc(o: ts.Node): o is (ts.Node & { jsDoc: ts.JSDoc[] }) {
    return 'jsDoc' in o;
  }
  /**
   * Clean up `ts.Node` contents for logging
   */
  static collapseNodes(all: any[]) {
    return all.map(x => this.collapseNode(x));
  }

  /**
   * Clean up `ts.Node` contents for logging
   */
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
        try {
          out[key] = this.collapseNode(x[key], cache);
        } catch (err) {
          return undefined;
        }
      }
      return out;
    }
  }

  /**
   * Convert literal to a `ts.Node` type
   */
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

  /**
   * Convert a `ts.Node` to a JS literal
   */
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

  /**
   * Extend object literal, whether JSON or ts.ObjectLiteralExpression
   */
  static extendObjectLiteral(src: object | ts.Expression, ...rest: (object | ts.Expression)[]) {
    let ret = this.fromLiteral(src);
    if (rest.find(x => !!x)) {
      ret = ts.createObjectLiteral([
        ts.createSpreadAssignment(ret),
        ...(rest.filter(x => !!x).map(r => ts.createSpreadAssignment(this.fromLiteral(r))))
      ]);
    }
    return ret;
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static getPrimaryArgument<T extends ts.Expression = ts.Expression>(node: ts.CallExpression | ts.Decorator | undefined): T | undefined {
    if (node && ts.isDecorator(node)) {
      node = node.expression as ts.CallExpression;
    }
    if (node && node!.arguments && node!.arguments.length) {
      return node.arguments[0] as T;
    }
    return;
  }

  /**
   * Get a value from the an object expression
   */
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

  /**
   * Create a static field for a class
   */
  static createStaticField(name: string, val: ts.Expression | string | number): ts.PropertyDeclaration {
    return ts.createProperty(
      undefined,
      [ts.createToken(ts.SyntaxKind.StaticKeyword)],
      name, undefined, undefined,
      (typeof val === 'string' || typeof val === 'number') ? ts.createLiteral(val) : val as ts.Expression
    );
  }

  /**
   * Create a decorator with a given name, and arguments
   */
  static createDecorator(name: ts.Expression, ...contents: (ts.Expression | undefined)[]) {
    return ts.createDecorator(
      ts.createCall(
        name,
        undefined,
        contents.filter(x => !!x) as ts.Expression[]
      )
    );
  }

  /**
   * Get identifier for a decorator
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

  /**
   * Get `ts.Symbol` from a `ts.Type`
   */
  static getSymbol(type: ts.Type | ts.Symbol) {
    return 'valueDeclaration' in type ? type : (type.aliasSymbol ?? type.symbol);
  }

  /**
   * Get name of symbol from a symbol or type
   */
  static getSymbolName(type: ts.Type | ts.Symbol): string | undefined {
    return this.getSymbol(type)?.getName() || undefined;
  }

  /**
   * Find declaration for a type, symbol or a declaration
   */
  static getDeclarations(type: ts.Type | ts.Symbol | ts.Declaration[]): ts.Declaration[] {
    let decls: ts.Declaration[] = [];
    if (Array.isArray(type)) {
      decls = type;
    } else {
      decls = this.getSymbol(type)?.getDeclarations?.() ?? [];
    }
    return decls.filter(x => !!x);
  }

  /**
   * Find primary declaration out of a list of declarations
   */
  static getPrimaryDeclaration(decls: ts.Declaration[]): ts.Declaration {
    return decls?.[0];
  }

  /**
   * Read JS Docs from a `ts.Type` or a `ts.Node`
   */
  static readJSDocs(type: ts.Type | ts.Node) {
    let node = 'getSourceFile' in type ? type : this.getPrimaryDeclaration(this.getDeclarations(type));

    const out: DeclDocumentation = {
      description: undefined,
      return: undefined,
      params: []
    };

    if (node) {
      const tags = ts.getJSDocTags(node);
      while (!this.hasJSDoc(node) && this.hasOriginal(node)) {
        node = node.original;
      }

      const docs = this.hasJSDoc(node) ? node.jsDoc : undefined;

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

  /**
   * Read JS Doc tags for a type
   */
  static readJSDocTags(type: ts.Type, name: string) {
    const tags = this.getSymbol(type)?.getJsDocTags() ?? [];
    return tags
      .filter(el => el.name === name)
      .map(el => el.text!);
  }

  /**
   * Collect all imports for a source file, as a hash map
   */
  static collectImports(src: ts.SourceFile) {
    const pth = require.resolve(src.fileName);
    const base = FsUtil.resolveUnix(FsUtil.toUnix(pth));

    const imports = new Map<string, Import>();

    for (const stmt of src.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        let path = this.optionalResolve(stmt.moduleSpecifier.text, base);
        path = FrameworkUtil.devResolve(path); // @line-if $TRV_DEV

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

  /**
   * Add imports to a source file
   */
  public static addImports(file: ts.SourceFile, ...imports: Import[]) {
    if (!imports.length) {
      return file;
    }

    try {
      const importStmts = imports.map(({ path, ident }) => {
        const imptStmt = ts.createImportDeclaration(
          undefined, undefined,
          ts.createImportClause(undefined, ts.createNamespaceImport(ident)),
          ts.createLiteral(require.resolve(path))
        );
        return imptStmt;
      });

      const out = ts.updateSourceFileNode(file,
        ts.createNodeArray([
          ...importStmts,
          ...file.statements.filter((x: ts.Statement & { remove?: boolean }) => !x.remove) // Exclude culled imports
        ]),
        file.isDeclarationFile, file.referencedFiles,
        file.typeReferenceDirectives, file.hasNoDefaultLib);

      return out;
    } catch (err) { // Missing import
      const out = new Error(`${err.message} in ${file.fileName.replace(`${FsUtil.cwd}/`, '')}`);
      out.stack = err.stack;
      throw out;
    }
  }

  /**
   * Replace or add a decorator to a list of decorators
   */
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

  /**
   * Resolve a concrete type for a shape type, if the `@concrete` JS Doc tag is in place
   */
  static resolveConcreteType(type: ts.Type) {
    const tags = TransformUtil.readJSDocTags(type, 'concrete');
    if (tags.length) {
      const parts = tags[0].split(':');
      const fileName = this.getPrimaryDeclaration(this.getDeclarations(type))?.getSourceFile().fileName;
      if (parts.length === 1) {
        parts.unshift('.');
      }
      const source = parts[0] === '.' ? fileName : FsUtil.resolveUnix(dirname(fileName), parts[0]);
      return { name: parts[1], source };
    }
  }
}