import ts from 'typescript';
import { CoreUtil } from './core.ts';

/**
 * Utilities for dealing with decorators
 */
export class DecoratorUtil {

  static #getIdentFromExpression(expr: ts.Expression): ts.Identifier {
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
      return expr.expression;
    } else if (ts.isIdentifier(expr)) {
      return expr;
    } else if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression) && ts.isIdentifier(expr.expression.expression)) {
      return expr.expression.expression;
    } else if (ts.isPropertyAccessExpression(expr) && ts.isCallExpression(expr.expression) && ts.isIdentifier(expr.expression.expression)) {
      return expr.expression.expression;
    } else if (ts.isParenthesizedExpression(expr)) {
      return this.#getIdentFromExpression(expr.expression);
    } else {
      throw new Error('No Identifier');
    }
  }

  /**
   * Get identifier for a decorator
   */
  static getDecoratorIdentifier(decorator: ts.Decorator): ts.Identifier {
    const identifier = this.#getIdentFromExpression(decorator.expression);
    if (!identifier) {
      throw new Error('No Identifier');
    } else {
      return identifier;
    }
  }

  /**
   * Replace or add a decorator to a list of decorators
   */
  static spliceDecorators(node: ts.Node, target: ts.Decorator | undefined, replacements: ts.Decorator[], index = -1): ts.ModifierLike[] {
    if (!ts.canHaveDecorators(node)) {
      return [];
    }
    if (index < 0 && target) {
      index = node.modifiers?.indexOf(target) ?? -1;
    }
    const out = (node.modifiers ?? []).filter(x => x !== target);
    if (index < 0) {
      out.push(...replacements);
    } else {
      out.splice(index, 0, ...replacements);
    }
    return out;
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static getPrimaryArgument(node: ts.Decorator | undefined): ts.Expression | undefined {
    return CoreUtil.firstArgument(node && ts.isCallExpression(node.expression) ? node.expression : undefined);
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static getArguments(node: ts.Decorator | undefined): ts.Expression[] | undefined {
    return node && ts.isCallExpression(node.expression) ? [...node.expression.arguments] : undefined;
  }
}