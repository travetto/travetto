import * as ts from 'typescript';
import { CoreUtil } from './core';

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
    return !(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.NonPublicAccessibilityModifier);
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
  static getPrimaryDeclaration(decls: ts.Declaration[]): ts.Declaration {
    return decls?.[0];
  }

  /**
   * Find primary declaration out of a list of declarations
   */
  static getPrimaryDeclarationNode(node: ts.Type | ts.Symbol): ts.Declaration {
    return this.getPrimaryDeclaration(this.getDeclarations(node));
  }

  /**
   * Resolve the `ts.ObjectFlags`
   */
  static getObjectFlags(type: ts.Type): ts.ObjectFlags {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (ts as unknown as { getObjectFlags(t: ts.Type): ts.ObjectFlags }).getObjectFlags(type);
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
      for (const el of node.parent.members) {
        if (el.name && el.name.getText() === node.name.getText()) {
          if (ts.isGetAccessor(el)) {
            acc.getter = el;
          } else if (ts.isSetAccessor(el)) {
            acc.setter = el;
          }
          if (acc.getter && acc.setter) {
            return acc;
          }
        }
      }
    }
    return acc;
  }
}