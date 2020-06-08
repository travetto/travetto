import * as ts from 'typescript';

/**
 * Utilities for dealing with literals
 */
export class LiteralUtil {

  /**
   * Determine if a type is a literal type
   * @param type
   */
  static isLiteralType(type: ts.Type): type is ts.LiteralType {
    const flags = type.getFlags();
    // eslint-disable-next-line no-bitwise
    return (flags & (ts.TypeFlags.BooleanLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.StringLiteral)) > 0;
  }

  /**
   * Convert literal to a `ts.Node` type
   */
  static fromLiteral<T extends ts.Expression>(val: T): T;
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
    if (strict) {
      throw new Error(`Not a valid input, should be a valid ts.Node: ${val.kind}`);
    }
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
}