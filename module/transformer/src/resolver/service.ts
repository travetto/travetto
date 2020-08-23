import * as ts from 'typescript';

import { AnyType, Checker } from './types';
import { TypeCategorize, TypeBuilder } from './builder';
import { VisitCache } from './cache';
import { DocUtil } from '../util';

/**
 * Type resolver
 */
export class TypeResolver implements Checker {
  constructor(private tsChecker: ts.TypeChecker) { }

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
    return this.tsChecker.getTypeArguments(ref as ts.TypeReference) as ts.Type[];
  }

  /**
   * Resolve the return type for a method
   */
  getReturnType(node: ts.MethodDeclaration) {
    const type = this.getType(node);
    const [sig] = type.getCallSignatures();
    return this.tsChecker.getReturnTypeOfSignature(sig);
  }

  /**
   * Get type as a string representation
   */
  getTypeAsString(type: ts.Type) {
    return this.tsChecker.typeToString(this.tsChecker.getApparentType(type)) || undefined;
  }

  /**
   * Get list of properties
   */
  getPropertiesOfType(type: ts.Type) {
    return this.tsChecker.getPropertiesOfType(type);
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

      let result = build(this, type, alias);

      // Convert via cache if needed
      result = visited.getOrSet(type, result);

      // Recurse
      if (result) {
        result.original = resType;
        result.comment = DocUtil.describeDocs(type).description;

        if ('tsTypeArguments' in result) {
          result.typeArguments = result.tsTypeArguments!.map((elType, i) => resolve(elType, type.aliasSymbol, depth + 1));
          delete result.tsTypeArguments;
        }
        if ('tsFieldTypes' in result) {
          const fields: Record<string, AnyType> = {};
          for (const [name, fieldType] of Object.entries(result.tsFieldTypes ?? [])) {
            fields[name] = resolve(fieldType, undefined, depth + 1);
          }
          result.fieldTypes = fields;
          delete result.tsFieldTypes;
        }
        if ('tsSubTypes' in result) {
          result.subTypes = result.tsSubTypes!.map((elType, i) => resolve(elType, type.aliasSymbol, depth + 1));
          delete result.tsSubTypes;
        }
        if (finalize) {
          result = finalize(result as never);
        }
      }

      return result ?? { key: 'literal', ctor: Object, name: 'object' };
    };

    try {
      return resolve(this.getType(node));
    } catch (err) {
      console.error(`Unable to resolve type`, err.stack);
      return { key: 'literal', ctor: Object, name: 'object' };
    }
  }
}