import * as ts from 'typescript';

import { FsUtil } from '@travetto/boot';
import { AppInfo } from '@travetto/base';
import { ConfigSource } from '@travetto/config';
import { DecList, Import } from './types';

export class TransformUtil {

  static aliasMapper<T>(ns: string, onItem: (pkg: string, cls: string) => T) {
    // Class to package, to element
    if (ns && ns !== '*') {
      const obj = ConfigSource.get(`decorator.${ns}`);
      for (const pkg of Object.keys(obj)) {
        const val = obj[pkg];
        for (const cls of Array.isArray(val) ? val : [val]) {
          onItem(pkg, cls);
        }
      }
    } else {
      const obj = ConfigSource.get('decorator');
      for (const space of Object.keys(obj)) {
        this.aliasMapper(space, onItem);
      }
    }
  }

  static extractPackage(path: string) {
    path = FsUtil.toUnix(path);

    if (path.includes('@travetto') || (!path.includes('node_modules') && AppInfo.PACKAGE === '@travetto')) {
      let pkg = '';
      if (!path.includes('node_modules')) {
        pkg = AppInfo.NAME;
      } else {
        pkg = `@travetto/${path.split(/@travetto[\/]/)[1].split(/[\/]/)[0]}`;
      }
      return pkg;
    }
  }

  static getDecoratorList(node: ts.Node) {
    return ((node.decorators || []) as any as DecList)
      .map(dec => {
        const ident = TransformUtil.getDecoratorIdent(dec);
        return ({
          dec,
          ident: ts.isIdentifier(ident) ?
            ident.escapedText! as string :
            undefined as any as string
        });
      })
      .filter(x => !!x.ident);
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

  static customDecoratorMatcher<T>(
    ns: string,
    onDecorator: (pkg: string, name: string, dec: ts.Decorator) => T,
  ) {
    const aliases = new Map<string, Set<string>>();
    this.aliasMapper(ns, (pkg, cls) => {
      if (!aliases.has(cls)) {
        aliases.set(cls, new Set());
      }
      aliases.get(cls)!.add(pkg);
    });

    const decCache = Symbol('decCache');

    return (node: ts.Node, imports: Map<string, Import>) => {
      if (!(node as any)[decCache]) {
        const out = new Map<string, T>();
        for (const { ident, dec } of this.getDecoratorList(node)) {
          const imp = imports.get(ident);
          const pkgs = aliases.get(ident);
          if (imp && pkgs && pkgs.has(imp.pkg!)) {
            out.set(ident, onDecorator(imp.pkg!, ident, dec));
          }
        }
        (node as any)[decCache] = out;
      }
      return (node as any)[decCache] as Map<string, T>;
    };
  }

  static allDecoratorMatcher() {
    return this.customDecoratorMatcher('*', (pkg: string, name: string, dec: ts.Decorator) => {
      return { pkg, name, dec };
    });
  }

  static decoratorMatcher(ns: string) {
    return this.customDecoratorMatcher(ns, (pkg, name, dec) => {
      return dec;
    });
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
      const out: Record<string, any> = {};
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

  /*
   * useful for handling failed imports, but still transpiling
   */
  static optionalResolve(file: string) {
    try {
      return require.resolve(file);
    } catch {
      return file;
    }
  }

  static createStaticField(name: string, val: ts.Expression | string | number) {
    return ts.createProperty(
      undefined,
      [ts.createToken(ts.SyntaxKind.StaticKeyword)],
      name, undefined, undefined, ['string', 'number'].includes(typeof val) ? ts.createLiteral(val as any) : val as ts.Expression
    );
  }
}