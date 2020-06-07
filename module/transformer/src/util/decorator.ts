import * as ts from 'typescript';
import { CoreUtil } from './core';

/**
 * Utilities for dealing with decorators
 */
export class DecoratorUtil {

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
   * Replace or add a decorator to a list of decorators
   */
  static spliceDecorators(node: { decorators?: ts.MethodDeclaration['decorators'] }, target: ts.Decorator | undefined, replacements: ts.Decorator[], idx = -1) {
    const out = (node.decorators ?? []).filter(x => x !== target);
    out.splice(idx, 0, ...replacements);
    return out;
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static getPrimaryArgument<T extends ts.Expression = ts.Expression>(node: ts.Decorator | undefined): T | undefined {
    return CoreUtil.getPrimaryArgument(node && ts.isCallExpression(node.expression) ? node.expression : undefined);
  }
}