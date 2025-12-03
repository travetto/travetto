import ts from 'typescript';

/**
 * Core utilities util
 */
export class CoreUtil {

  /**
   * See if inbound node has an original property
   */
  static hasOriginal(value: ts.Node): value is (ts.Node & { original: ts.Node }) {
    return 'original' in value && !!value.original;
  }

  /**
   * See if type has target
   */
  static hasTarget(value: ts.Type): value is (ts.Type & { target: ts.Type }) {
    return 'target' in value && !!value.target;
  }

  /**
   * Get code range of node
   */
  static getRangeOf<T extends ts.Node>(source: ts.SourceFile, value: T | undefined): [start: number, end: number] | undefined {
    if (value && value.pos >= 0) {
      const start = ts.getLineAndCharacterOfPosition(source, value.getStart(source));
      const end = ts.getLineAndCharacterOfPosition(source, value.getEnd());
      return [start.line + 1, end.line + 1];
    }
  }

  /**
   * Find the primary argument of a call expression, or decorator.
   */
  static findArgument<T extends ts.Expression = ts.Expression>(
    node: ts.CallExpression | undefined,
    pred: (expr: ts.Expression) => expr is T
  ): T | undefined {
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
   * @param source
   * @param statements
   */
  static updateSource(factory: ts.NodeFactory, source: ts.SourceFile, statements: ts.NodeArray<ts.Statement> | ts.Statement[]): ts.SourceFile {
    return factory.updateSourceFile(
      source, statements, source.isDeclarationFile, source.referencedFiles, source.typeReferenceDirectives, source.hasNoDefaultLib
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
      (acc, value) => typeof value === 'number' ?
        factory.createElementAccessExpression(acc, value) :
        factory.createPropertyAccessExpression(acc, value),
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
        contents.filter(expr => !!expr)
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