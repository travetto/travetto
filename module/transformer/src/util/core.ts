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
   * Resolve the `ts.ObjectFlags`
   */
  static getObjectFlags(type: ts.Type): ts.ObjectFlags {
    // @ts-ignore
    return ts.getObjectFlags(type);
  }

  /**
   * See if a declaration is public
   */
  static isPublic(node: ts.Declaration) {
    // eslint-disable-next-line no-bitwise
    return !(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.NonPublicAccessibilityModifier);
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
  static createStaticField(name: string, val: ts.Expression | string | number): ts.PropertyDeclaration {
    return ts.createProperty(
      undefined,
      [ts.createToken(ts.SyntaxKind.StaticKeyword)],
      name, undefined, undefined,
      (typeof val === 'string' || typeof val === 'number') ? ts.createLiteral(val) : val as ts.Expression
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
  static updateSource(src: ts.SourceFile, statements: ts.Statement[]) {
    return ts.updateSourceFileNode(
      src, statements, src.isDeclarationFile, src.referencedFiles, src.typeReferenceDirectives, src.hasNoDefaultLib
    );
  }
}