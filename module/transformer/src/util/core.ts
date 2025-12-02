import ts from 'typescript';

/**
 * Core utilities util
 */
export class CoreUtil {

  /**
   * See if inbound node has an original property
   */
  static hasOriginal(o: ts.Node): o is (ts.Node & { original: ts.Node }) {
    return 'original' in o && !!o.original;
  }

  /**
   * See if type has target
   */
  static hasTarget(o: ts.Type): o is (ts.Type & { target: ts.Type }) {
    return 'target' in o && !!o.target;
  }

  /**
   * Get code range of node
   * @param m
   */
  static getRangeOf<T extends ts.Node>(source: ts.SourceFile, o: T | undefined): [start: number, end: number] | undefined {
    if (o && o.pos >= 0) {
      const start = ts.getLineAndCharacterOfPosition(source, o.getStart(source));
      const end = ts.getLineAndCharacterOfPosition(source, o.getEnd());
      return [start.line + 1, end.line + 1];
    }
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static findArgument<T extends ts.Expression = ts.Expression>(node: ts.CallExpression | undefined, pred: (x: ts.Expression) => x is T): T | undefined {
    if (node && node.arguments && node.arguments.length) {
      return node.arguments.find(pred);
    }
  }

  /**
   * Find the first argument of a call expression, or decorator.
   */
  static firstArgument(node: ts.CallExpression | undefined): ts.Expression | undefined {
    if (node && node!.arguments && node!.arguments.length) {
      return node.arguments[0];
    }
  }

  /**
   * Create a static field for a class
   */
  static createStaticField(factory: ts.NodeFactory, name: string, value: ts.Expression): ts.PropertyDeclaration {
    return factory.createPropertyDeclaration(
      [factory.createToken(ts.SyntaxKind.StaticKeyword)],
      name, undefined, undefined, value
    );
  }

  /**
   * Get `ts.Symbol` from a `ts.Type`
   */
  static getSymbol(type: ts.Type | ts.Symbol | ts.TypeReference): ts.Symbol {
    if ('valueDeclaration' in type || 'escapedName' in type) {
      return type;
    } else if ('aliasSymbol' in type && type.aliasSymbol) {
      return type.aliasSymbol;
    } else {
      return type.symbol;
    }
  }

  /**
   * Updates source
   * @param src
   * @param statements
   */
  static updateSource(factory: ts.NodeFactory, src: ts.SourceFile, statements: ts.NodeArray<ts.Statement> | ts.Statement[]): ts.SourceFile {
    return factory.updateSourceFile(
      src, statements, src.isDeclarationFile, src.referencedFiles, src.typeReferenceDirectives, src.hasNoDefaultLib
    );
  }

  /**
   * Create property access
   */
  static createAccess(
    factory: ts.NodeFactory,
    first: string | ts.Expression,
    second: string | ts.Identifier,
    ...items: (string | number | ts.Identifier)[]
  ): ts.Expression {
    if (typeof first === 'string') {
      first = factory.createIdentifier(first);
    }
    return items.reduce<ts.Expression>(
      (acc, p) => typeof p === 'number' ?
        factory.createElementAccessExpression(acc, p) :
        factory.createPropertyAccessExpression(acc, p),
      factory.createPropertyAccessExpression(first, second)
    );
  }

  /**
   * Create a decorator with a given name, and arguments
   */
  static createDecorator(factory: ts.NodeFactory, name: ts.Expression, ...contents: (ts.Expression | undefined)[]): ts.Decorator {
    return factory.createDecorator(
      factory.createCallExpression(
        name,
        undefined,
        contents.filter(x => !!x)
      )
    );
  }

  /**
   * Is declaration abstract?
   */
  static isAbstract(node: ts.Declaration): boolean {
    // eslint-disable-next-line no-bitwise
    return !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Abstract);
  }
}