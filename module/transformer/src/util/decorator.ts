import * as ts from 'typescript';
import { CoreUtil } from './core';

/**
 * Utilities for dealing with decorators
 */
export class DecoratorUtil {

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
   * Replace or add a decorator to a list of decorators
   */
  static spliceDecorators(node: ts.Node, target: ts.Decorator | undefined, replacements: ts.Decorator[], idx = -1) {
    if (idx < 0 && target) {
      idx = node.decorators?.indexOf(target) ?? -1;
    }
    const out = (node.decorators ?? []).filter(x => x !== target);
    if (idx < 0) {
      out.push(...replacements);
    } else {
      out.splice(idx, 0, ...replacements);
    }
    return out;
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static getPrimaryArgument<T extends ts.Expression = ts.Expression>(node: ts.Decorator | undefined): T | undefined {
    return CoreUtil.getArgument(node && ts.isCallExpression(node.expression) ? node.expression : undefined);
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static getArguments<T extends ts.Expression = ts.Expression>(node: ts.Decorator | undefined): T[] | undefined {
    return node && ts.isCallExpression(node.expression) ? [...node.expression.arguments] as T[] : undefined;
  }
}