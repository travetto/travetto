import * as ts from 'typescript';

/**
 * Core utilities util
 */
export class CoreUtil {
  /**
   * See if inbound node has an original property
   */
  static hasOriginal(o: ts.Node): o is (ts.Node & { original: ts.Node }) {
    return 'original' in o && !!(o as { original?: ts.Node }).original;
  }

  /**
   * See if type has target
   */
  static hasTarget(o: ts.Type): o is (ts.Type & { target: ts.Type }) {
    return 'target' in o && !!(o as { target?: ts.Type }).target;
  }

  /**
   * Get first line of method body
   * @param m
   */
  static getRangeOf<T extends ts.Node>(source: ts.SourceFile, o: T | undefined) {
    if (o) {
      const start = ts.getLineAndCharacterOfPosition(source, o.getStart(source));
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
  static getArgument<T extends ts.Expression = ts.Expression>(node: ts.CallExpression | undefined, position = 0): T | undefined {
    if (node && node!.arguments && node!.arguments.length >= position + 1) {
      return node.arguments[position] as T;
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
    if ('valueDeclaration' in type || 'escapedName' in type) {
      return type;
    } else {
      return (type as ts.TypeReference).aliasSymbol ?? (type as ts.Type).symbol;
    }
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
        contents.filter((x?: ts.Expression): x is ts.Expression => !!x)
      )
    );
  }

  /**
   * Is declaration abstract?
   */
  static isAbstract(node: ts.Declaration) {
    // eslint-disable-next-line no-bitwise
    return !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Abstract);
  }
}