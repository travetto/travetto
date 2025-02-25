import ts from 'typescript';
import { CoreUtil } from './core.ts';

/**
 * Utilities for dealing with decorators
 */
export class DecoratorUtil {

  static #getIdentFromExpression(e: ts.Expression): ts.Identifier {
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
      return e.expression;
    } else if (ts.isIdentifier(e)) {
      return e;
    } else if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && ts.isIdentifier(e.expression.expression)) {
      return e.expression.expression;
    } else if (ts.isPropertyAccessExpression(e) && ts.isCallExpression(e.expression) && ts.isIdentifier(e.expression.expression)) {
      return e.expression.expression;
    } else if (ts.isParenthesizedExpression(e)) {
      return this.#getIdentFromExpression(e.expression);
    } else {
      throw new Error('No Identifier');
    }
  }

  /**
   * Get identifier for a decorator
   */
  static getDecoratorIdent(d: ts.Decorator): ts.Identifier {
    const ident = this.#getIdentFromExpression(d.expression);
    if (!ident) {
      throw new Error('No Identifier');
    } else {
      return ident;
    }
  }

  /**
   * Replace or add a decorator to a list of decorators
   */
  static spliceDecorators(node: ts.Node, target: ts.Decorator | undefined, replacements: ts.Decorator[], idx = -1): ts.ModifierLike[] {
    if (!ts.canHaveDecorators(node)) {
      return [];
    }
    if (idx < 0 && target) {
      idx = node.modifiers?.indexOf(target) ?? -1;
    }
    const out = (node.modifiers ?? []).filter(x => x !== target);
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