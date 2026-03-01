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
    // eslint-disable-next-line no-bitwise
    return !(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.NonPublicAccessibilityModifier) &&
      (!isNamed(node) || !ts.isPrivateIdentifier(node.name));
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
    // eslint-disable-next-line no-bitwise
    return _ts.getObjectFlags!(type) & ~(ts.NodeFlags.ThisNodeOrAnySubNodesHasError);
  }

  /**
   * Get accessor pair based off of passing in one in
   *
   * @param node
   * @returns
   */
  static getAccessorPair(
    node: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
  ): { getter?: ts.GetAccessorDeclaration, setter?: ts.SetAccessorDeclaration } {
    const pair = { getter: ts.isGetAccessorDeclaration(node) ? node : undefined, setter: ts.isSetAccessorDeclaration(node) ? node : undefined };
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
}