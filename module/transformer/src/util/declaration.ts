import ts from 'typescript';
import { CoreUtil } from './core.ts';

const isNamed = (o: ts.Declaration): o is ts.Declaration & { name: ts.Node } => 'name' in o && !!o.name;

/**
 * Declaration utils
 */
export class DeclarationUtil {

  /**
   * Searches upward from the node until it finds the variable declaration list,
   * and then checks the toString for `const `
   */
  static isConstantDeclaration(node: ts.Node): boolean {
    let s: ts.Node = node;
    while (s && !ts.isVariableDeclarationList(s)) {
      s = s.parent;
    }
    return s?.getText().startsWith('const '); // Cheap out on check, ts is being weird
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
    let decls: ts.Declaration[] = [];
    if (Array.isArray(type)) {
      decls = type;
    } else {
      decls = CoreUtil.getSymbol(type)?.getDeclarations?.() ?? [];
    }
    return decls.filter(x => !!x);
  }

  /**
   * Find primary declaration out of a list of declarations
   */
  static getPrimaryDeclarationNode(node: ts.Type | ts.Symbol): ts.Declaration {
    const decls = this.getDeclarations(node);
    if (!decls.length) {
      throw new Error('No declarations found for type');
    }
    return decls[0];
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
    const _ts: typeof ts & { getObjectFlags?(t: ts.Type): ts.ObjectFlags } = ts;
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
    const acc = { getter: ts.isGetAccessorDeclaration(node) ? node : undefined, setter: ts.isSetAccessorDeclaration(node) ? node : undefined };
    if (ts.isClassDeclaration(node.parent)) {
      for (const member of node.parent.members) {
        if (member.name && member.name.getText() === node.name.getText()) {
          if (ts.isGetAccessor(member)) {
            acc.getter = member;
          } else if (ts.isSetAccessor(member)) {
            acc.setter = member;
          }
          if (acc.getter && acc.setter) {
            return acc;
          }
        }
      }
    }
    return acc;
  }

  static isStatic(node: ts.Declaration): boolean {
    if ('modifiers' in node && Array.isArray(node.modifiers)) {
      return node.modifiers?.some(x => x.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    }
    return false;
  }
}