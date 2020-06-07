import * as ts from 'typescript';

import { AnyType } from './types';
import { TypeCategorize, TypeBuilder } from './builder';
import { TransformUtil } from '../util';
import { VisitCache } from './cache';

/**
 * Type resolver
 */
export class TypeResolver {
  constructor(private tsChecker: ts.TypeChecker) { }

  /**
   * Get type from element
   * @param el
   */
  getTypeOrSymbol(el: ts.Type | ts.Node | ts.Symbol) {
    return 'getSourceFile' in el ? this.tsChecker.getTypeAtLocation(el as ts.Node) : el;
  }

  /**
   * Get type from element
   * @param el
   */
  getType(el: ts.Type | ts.Node) {
    return 'getSourceFile' in el ? this.tsChecker.getTypeAtLocation(el as ts.Node) : el;
  }


  /**
   * Fetch all type arguments for a give type
   */
  getAllTypeArguments(ref: ts.Type): ts.Type[] {
    return TransformUtil.getAllTypeArguments(this.tsChecker, ref);
  }

  /**
   * Resolve the return type for a method
   */
  getReturnType(node: ts.MethodDeclaration) {
    return TransformUtil.getReturnType(this.tsChecker, node);
  }

  /**
   * Read JS Doc tags by name
   */
  readDocTag(node: ts.Declaration, name: string): string[] {
    return TransformUtil.readDocTag(this.tsChecker.getTypeAtLocation(node), name);
  }

  /**
   * Get all declarations of a node
   */
  getDeclarations(node: ts.Node | ts.Type | ts.Symbol): ts.Declaration[] {
    return TransformUtil.getDeclarations(this.getTypeOrSymbol(node));
  }

  /**
   * Get primary declaration of a node
   */
  getPrimaryDeclaration(node: ts.Node | ts.Symbol | ts.Type): ts.Declaration {
    return TransformUtil.getPrimaryDeclarationNode(this.getTypeOrSymbol(node));
  }

  /**
   * Resolve an `AnyType` from a `ts.Type` or a `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node): AnyType {
    const visited = new VisitCache();
    const resolve = (resType: ts.Type, alias?: ts.Symbol, depth = 0): AnyType => {

      if (depth > 20) { // Max depth is 20
        throw new Error('Object structure too nested');
      }

      const { category, type } = TypeCategorize(this.tsChecker, resType);
      const { build, finalize } = TypeBuilder[category];

      let result = build(this.tsChecker, type, alias);

      if (result) {
        console.debug('Detected', result?.key);
      } else {
        console.debug('Not Detected');
      }

      // Convert via cache if needed
      result = visited.getOrSet(type, result);

      // Recurse
      if (result) {
        if ('tsTypeArguments' in result) {
          result.typeArguments = result.tsTypeArguments!.map((elType, i) => resolve(elType, type.aliasSymbol, depth + 1));
          delete result.tsTypeArguments;
        }
        if ('tsFieldTypes' in result) {
          const fields: Record<string, AnyType> = {};
          for (const [name, fieldType] of Object.entries(result.tsFieldTypes ?? [])) {
            fields[name] = resolve(fieldType, undefined, depth + 1);
          }
          result.fields = fields;
          delete result.tsFieldTypes;
        }
        if ('tsSubTypes' in result) {
          result.subTypes = result.tsSubTypes!.map((elType, i) => resolve(elType, type.aliasSymbol, depth + 1));
          delete result.tsSubTypes;
        }
        if (finalize) {
          result = finalize(result as any);
        }
      }

      return result ?? { key: 'literal', ctor: Object, name: 'object' };
    };

    try {
      return resolve(this.getType(node));
    } catch (err) {
      console.error(`Unable to resolve type`, err);
      return { key: 'literal', ctor: Object, name: 'object' };
    }
  }
}