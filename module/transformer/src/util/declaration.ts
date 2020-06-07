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
  static isConstantDeclaration(node: ts.Node) {
    let s: ts.Node = node;
    while (s && !ts.isVariableDeclarationList(s)) {
      s = s.parent;
    }
    return s?.getText().startsWith('const '); // Cheap out on check, ts is being weird
  }

  /**
   * See if a declaration is public
   */
  static isPublic(node: ts.Declaration) {
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
}