import ts from 'typescript';

import { transformCast, type TemplateLiteral } from '../types/shared.ts';

const TypedObject: {
  keys<T = unknown, K extends keyof T = keyof T>(value: T): K[];
} & ObjectConstructor = Object;

function isNode(value: unknown): value is ts.Node {
  return !!value && typeof value === 'object' && 'kind' in value;
}

const KNOWN_FNS = new Set<unknown>([String, Number, Boolean, Date, RegExp]);

function isKnownFn(value: unknown): value is Function {
  return KNOWN_FNS.has(value);
}

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
  static fromLiteral<T extends ts.Expression>(factory: ts.NodeFactory, value: T): T;
  static fromLiteral(factory: ts.NodeFactory, value: undefined): ts.Identifier;
  static fromLiteral(factory: ts.NodeFactory, value: null): ts.NullLiteral;
  static fromLiteral(factory: ts.NodeFactory, value: object): ts.ObjectLiteralExpression;
  static fromLiteral(factory: ts.NodeFactory, value: unknown[]): ts.ArrayLiteralExpression;
  static fromLiteral(factory: ts.NodeFactory, value: string): ts.StringLiteral;
  static fromLiteral(factory: ts.NodeFactory, value: number): ts.NumericLiteral;
  static fromLiteral(factory: ts.NodeFactory, value: boolean): ts.BooleanLiteral;
  static fromLiteral(factory: ts.NodeFactory, value: unknown): ts.Node {
    if (isNode(value)) { // If already a node
      return value;
    } else if (Array.isArray(value)) {
      value = factory.createArrayLiteralExpression(value.map(element => this.fromLiteral(factory, element)));
    } else if (value === undefined) {
      value = factory.createIdentifier('undefined');
    } else if (value === null) {
      value = factory.createNull();
    } else if (typeof value === 'string') {
      value = factory.createStringLiteral(value);
    } else if (typeof value === 'number') {
      const number = factory.createNumericLiteral(Math.abs(value));
      value = value < 0 ? factory.createPrefixMinus(number) : number;
    } else if (typeof value === 'bigint') {
      value = factory.createBigIntLiteral(value.toString());
    } else if (typeof value === 'boolean') {
      value = value ? factory.createTrue() : factory.createFalse();
    } else if (value instanceof RegExp) {
      value = factory.createRegularExpressionLiteral(`/${value.source}/${value.flags ?? ''}`);
    } else if (isKnownFn(value)) {
      value = factory.createIdentifier(value.name);
    } else {
      const ov = value;
      const pairs: ts.PropertyAssignment[] = [];
      for (const key of TypedObject.keys(ov)) {
        if (ov[key] !== undefined) {
          pairs.push(
            factory.createPropertyAssignment(key, this.fromLiteral(factory, ov[key]))
          );
        }
      }
      return factory.createObjectLiteralExpression(pairs);
    }
    return transformCast(value);
  }

  /**
   * Convert a `ts.Node` to a JS literal
   */
  static toLiteral(value: ts.NullLiteral, strict?: boolean): null;
  static toLiteral(value: ts.NumericLiteral, strict?: boolean): number;
  static toLiteral(value: ts.StringLiteral, strict?: boolean): string;
  static toLiteral(value: ts.BooleanLiteral, strict?: boolean): boolean;
  static toLiteral(value: ts.ObjectLiteralExpression, strict?: boolean): object;
  static toLiteral(value: ts.ArrayLiteralExpression, strict?: boolean): unknown[];
  static toLiteral(value: undefined, strict?: boolean): undefined;
  static toLiteral(value: ts.Node, strict?: boolean): unknown;
  static toLiteral(value?: ts.Node, strict = true): unknown {
    if (!value) {
      throw new Error('Value is not defined');
    } else if (ts.isArrayLiteralExpression(value)) {
      return value.elements.map(item => this.toLiteral(item, strict));
    } else if (ts.isIdentifier(value)) {
      if (value.getText() === 'undefined') {
        return undefined;
      } else if (!strict) {
        return value.getText();
      }
    } else if (value.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    } else if (ts.isStringLiteral(value)) {
      return value.text;
    } else if (ts.isBigIntLiteral(value)) {
      return BigInt(value.text.replace(/n$/i, ''));
    } else if (ts.isNumericLiteral(value)) {
      const txt = value.text;
      if (txt.includes('.')) {
        return parseFloat(txt);
      } else {
        return parseInt(txt, 10);
      }
    } else if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(value.operand)) {
      const txt = value.operand.text;
      if (txt.includes('.')) {
        return -parseFloat(txt);
      } else {
        return -parseInt(txt, 10);
      }
    } else if (value.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    } else if (value.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    } else if (ts.isObjectLiteralExpression(value)) {
      const out: Record<string, unknown> = {};
      for (const pair of value.properties) {
        if (ts.isPropertyAssignment(pair)) {
          out[pair.name.getText()] = this.toLiteral(pair.initializer, strict);
        }
      }
      return out;
    }
    if (strict) {
      throw new Error(`Not a valid input, should be a valid ts.Node: ${value.kind}`);
    }
  }

  /**
   * Extend object literal, whether JSON or ts.ObjectLiteralExpression
   */
  static extendObjectLiteral(factory: ts.NodeFactory, source: object | ts.Expression, ...rest: (object | ts.Expression)[]): ts.ObjectLiteralExpression {
    let literal = this.fromLiteral(factory, source);
    if (rest.find(item => !!item)) {
      literal = factory.createObjectLiteralExpression([
        factory.createSpreadAssignment(literal),
        ...(rest.filter(item => !!item).map(expression => factory.createSpreadAssignment(this.fromLiteral(factory, expression))))
      ]);
    }
    return literal;
  }

  /**
   * Get a value from the an object expression
   */
  static getObjectValue(node: ts.Expression | undefined, key: string): ts.Expression | undefined {
    if (node && ts.isObjectLiteralExpression(node) && node.properties) {
      for (const property of node.properties) {
        if (property.name!.getText() === key) {
          if (ts.isPropertyAssignment(property)) {
            return property.initializer;
          } else if (ts.isShorthandPropertyAssignment(property)) {
            return property.name;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Flatten a template literal into a regex
   */
  static templateLiteralToRegex(template: TemplateLiteral, exact = true): string {
    const out: string[] = [];
    for (const value of template.values) {
      if (value === Number) {
        out.push('\\d+');
      } else if (value === Boolean) {
        out.push('(?:true|false)');
      } else if (value === String) {
        out.push('.+');
      } else if (typeof value === 'bigint') {
        out.push(`${value}n`);
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        out.push(`${value}`);
      } else {
        out.push(`(?:${this.templateLiteralToRegex(transformCast(value), false)})`);
      }
    }
    const body = out.join(template.operation === 'and' ? '' : '|');
    if (exact) {
      return `^(?:${body})$`;
    } else {
      return body;
    }
  }
}