import * as ts from 'typescript';

import { AnyType } from './types';
import { TypeCategorize, TypeBuilder } from './builder';
import { TransformUtil } from '../util';

// FIXME: Provide support for recursive types and resolution
/**
 * Type resolver
 */
export class TypeResolver {
  constructor(private tsChecker: ts.TypeChecker) { }

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
  readDocsTags(node: ts.Node, name: string): string[] {
    return TransformUtil.readJSDocTags(node, name, this.tsChecker);
  }

  /**
   * Get all declarations of a node
   */
  getDeclarations(node: ts.Node | ts.Type | ts.Symbol): ts.Declaration[] {
    return TransformUtil.getDeclarations(node as ts.Node, this.tsChecker);
  }

  /**
   * Get primary declaration of a node
   */
  getPrimaryDeclaration(node: ts.Node | ts.Symbol | ts.Type): ts.Declaration {
    return TransformUtil.getPrimaryDeclarationFromNode(node as ts.Node, this.tsChecker);
  }

  /**
   * Finalize type
   */
  finalize(val: AnyType) {
    switch (val.key) {
      case 'union': {
        const { undefinable, nullable, unionTypes } = val;
        const [first] = unionTypes;

        if (unionTypes.length === 1) {
          val = { undefinable, nullable, ...first };
        } else if (first.key === 'literal' && unionTypes.every(el => el.name === first.name)) { // We have a common
          val.commonType = first;
        }
        break;
      }
    }
    delete val.typeInfo;
    return val;
  }

  /**
   * Resolve an `AnyType` from a `ts.Type` or a `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node): AnyType {
    const root = 'getSourceFile' in node ? this.tsChecker.getTypeAtLocation(node) : node;

    const resolve = (frame: { type: ts.Type, alias?: ts.Symbol }): AnyType => {
      let result = TypeBuilder[TypeCategorize(this.tsChecker, frame.type)](this.tsChecker, frame.type, frame.alias);

      // Recurse
      if (result?.typeInfo) {
        switch (result.key) {
          case 'shape': {
            const fields: Record<string, AnyType> = {};
            for (const [name, fieldNode] of Object.entries(result.typeInfo)) {
              fields[name] = resolve({ type: fieldNode });
            }
            result.fields = fields;
            break;
          }
          default: {
            const arr = result.typeInfo.map((type, i) => resolve({
              type,
              alias: i === 0 && ('aliasSymbol' in frame.type) ? frame.type.aliasSymbol : undefined,
            }));
            switch (result.key) {
              case 'union': result.unionTypes = arr; break;
              case 'tuple': result.tupleTypes = arr; break;
              default: result.typeArguments = arr;
            }
          }
        }
        result = this.finalize(result);
      }
      return result ?? { key: 'literal', ctor: Object, name: 'object' };
    };

    return resolve({ type: root });
  }
}