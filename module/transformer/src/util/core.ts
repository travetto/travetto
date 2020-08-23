import * as ts from 'typescript';

/**
 * Core utilities util
 */
export class CoreUtil {
  /**
   * See if inbound node has an original property
   */
  static hasOriginal(o: ts.Node): o is (ts.Node & { original: ts.Node }) {
    return 'original' in o && !!o['original'];
  }

  /**
   * Get first line of method body
   * @param m
   */
  static getRangeOf<T extends ts.Node>(source: ts.SourceFile, o: T | undefined) {
    if (o) {
      const start = ts.getLineAndCharacterOfPosition(source, o.getStart());
      const end = ts.getLineAndCharacterOfPosition(source, o.getEnd());
      return {
        start: start.line + 1,
        end: end.line + 1
      };
    }
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static getPrimaryArgument<T extends ts.Expression = ts.Expression>(node: ts.CallExpression | undefined): T | undefined {
    if (node && node!.arguments && node!.arguments.length) {
      return node.arguments[0] as T;
    }
    return;
  }

  /**
   * Create a static field for a class
   */
  static createStaticField(factory: ts.NodeFactory, name: string, val: ts.Expression): ts.PropertyDeclaration {
    return factory.createPropertyDeclaration(
      undefined,
      [factory.createToken(ts.SyntaxKind.StaticKeyword)],
      name, undefined, undefined, val
    );
  }

  /**
   * Get `ts.Symbol` from a `ts.Type`
   */
  static getSymbol(type: ts.Type | ts.Symbol) {
    return 'valueDeclaration' in type ? type : (type.aliasSymbol ?? type.symbol);
  }

  /**
   * Updates source
   * @param src
   * @param statements
   */
  static updateSource(factory: ts.NodeFactory, src: ts.SourceFile, statements: ts.NodeArray<ts.Statement> | ts.Statement[]) {
    return factory.updateSourceFile(
      src, statements, src.isDeclarationFile, src.referencedFiles, src.typeReferenceDirectives, src.hasNoDefaultLib
    );
  }

  /**
   * Create property access
   */
  static createAccess(factory: ts.NodeFactory, first: string | ts.Expression, second: string | ts.Identifier, ...items: (string | ts.Identifier)[]) {
    if (typeof first === 'string') {
      first = factory.createIdentifier(first);
    }
    return items.reduce(
      (acc, p) => factory.createPropertyAccessExpression(acc, p),
      factory.createPropertyAccessExpression(first, second)
    );
  }

  /**
   * Create a decorator with a given name, and arguments
   */
  static createDecorator(factory: ts.NodeFactory, name: ts.Expression, ...contents: (ts.Expression | undefined)[]) {
    return factory.createDecorator(
      factory.createCallExpression(
        name,
        undefined,
        contents.filter(x => !!x) as ts.Expression[]
      )
    );
  }
}