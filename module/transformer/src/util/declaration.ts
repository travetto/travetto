import ts from 'typescript';
import { CoreUtil } from './core.ts';

const isNamed = (value: ts.Declaration): value is ts.Declaration & { name: ts.Node } => 'name' in value && !!value.name;

/**
 * Declaration utils
 */
export class DeclarationUtil {
  /**
   * Searches upward from the node until it finds the variable declaration list,
   * and then checks the toString for `const `
   */
  static isConstantDeclaration(node: ts.Node): boolean {
    let root: ts.Node = node;
    while (root && !ts.isVariableDeclarationList(root)) {
      root = root.parent;
    }
    return root?.getText().startsWith('const '); // Cheap out on check, ts is being weird
  }

  /**
   * See if a declaration is public
   */
  static isPublic(node: ts.Declaration): boolean {
    return (
      !(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.NonPublicAccessibilityModifier) &&
      (!isNamed(node) || !ts.isPrivateIdentifier(node.name))
    );
  }

  /**
   * Find declaration for a type, symbol or a declaration
   */
  static getDeclarations(type: ts.Type | ts.Symbol | ts.Declaration[]): ts.Declaration[] {
    let declarations: ts.Declaration[];
    if (Array.isArray(type)) {
      declarations = type;
    } else {
      declarations = CoreUtil.getSymbol(type)?.getDeclarations?.() ?? [];
    }
    return declarations.filter(declaration => !!declaration);
  }

  /**
   * Find primary declaration out of a list of declarations
   */
  static getPrimaryDeclarationNode(node: ts.Type | ts.Symbol): ts.Declaration {
    const declarations = this.getDeclarations(node);
    if (!declarations.length) {
      throw new Error('No declarations found for type');
    }
    return declarations[0];
  }

  /**
   * Find primary declaration out of a list of declarations
   */
  static getOptionalPrimaryDeclarationNode(node: ts.Type | ts.Symbol): ts.Declaration | undefined {
    return this.getDeclarations(node)[0];
  }

  /**
   * Resolve the `ts.ObjectFlags`
   */
  static getObjectFlags(type: ts.Type): ts.ObjectFlags {
    const _ts: typeof ts & { getObjectFlags?(node: ts.Type): ts.ObjectFlags } = ts;
    return _ts.getObjectFlags!(type) & ~ts.NodeFlags.ThisNodeOrAnySubNodesHasError;
  }

  /**
   * Get accessor pair based off of passing in one in
   *
   * @param node
   * @returns
   */
  static getAccessorPair(node: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration): {
    getter?: ts.GetAccessorDeclaration;
    setter?: ts.SetAccessorDeclaration;
  } {
    const pair = {
      getter: ts.isGetAccessorDeclaration(node) ? node : undefined,
      setter: ts.isSetAccessorDeclaration(node) ? node : undefined
    };
    if (ts.isClassDeclaration(node.parent)) {
      for (const member of node.parent.members) {
        if (member.name && member.name.getText() === node.name.getText()) {
          if (ts.isGetAccessor(member)) {
            pair.getter = member;
          } else if (ts.isSetAccessor(member)) {
            pair.setter = member;
          }
          if (pair.getter && pair.setter) {
            return pair;
          }
        }
      }
    }
    return pair;
  }

  static isStatic(node: ts.Declaration): boolean {
    if ('modifiers' in node && Array.isArray(node.modifiers)) {
      return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    }
    return false;
  }

  /**
   * Ensures a constructor exists in the class declaration, synthesizing one if necessary
   */
  static ensureConstructor(factory: ts.NodeFactory, node: ts.ClassDeclaration): ts.ClassDeclaration {
    const hasCons = node.members.some(member => ts.isConstructorDeclaration(member));
    if (hasCons) {
      return node;
    }

    const hasParent = node.heritageClauses?.some(clause => clause.token === ts.SyntaxKind.ExtendsKeyword);
    const newConsStatements: ts.Statement[] = [];
    let parameters: ts.ParameterDeclaration[] = [];
    if (hasParent) {
      parameters = [
        factory.createParameterDeclaration(
          undefined,
          factory.createToken(ts.SyntaxKind.DotDotDotToken),
          factory.createIdentifier('args'),
          undefined,
          factory.createArrayTypeNode(factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)),
          undefined
        )
      ];
      newConsStatements.push(
        factory.createExpressionStatement(
          factory.createCallExpression(factory.createSuper(), undefined, [factory.createSpreadElement(factory.createIdentifier('args'))])
        )
      );
    }
    const newCons = factory.createConstructorDeclaration(undefined, parameters, factory.createBlock(newConsStatements, true));
    return factory.updateClassDeclaration(node, node.modifiers, node.name, node.typeParameters, node.heritageClauses, [
      ...node.members,
      newCons
    ]);
  }

  /**
   * Calculates the insertion index for constructor statements (after super call, if exists)
   */
  static getConstructorInsertIndex(node: ts.ConstructorDeclaration): number {
    if (node.body) {
      const first = node.body.statements[0];
      if (
        first &&
        ts.isExpressionStatement(first) &&
        ts.isCallExpression(first.expression) &&
        first.expression.expression.kind === ts.SyntaxKind.SuperKeyword
      ) {
        return 1;
      }
    }
    return 0;
  }
}
