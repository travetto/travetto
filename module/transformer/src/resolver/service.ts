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
   * Resolve an `AnyType` from a `ts.Type` or a `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node): AnyType {
    const root = 'getSourceFile' in node ? this.tsChecker.getTypeAtLocation(node) : node;

    const resolve = (frame: { type: ts.Type, alias?: ts.Symbol }): AnyType => {
      const { build, finalize } = TypeBuilder[TypeCategorize(this.tsChecker, frame.type)];

      let result = build(this.tsChecker, frame.type, frame.alias);

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

        if (finalize) {
          result = finalize(result as any);
        }
        delete result.typeInfo;
      }
      return result ?? { key: 'literal', ctor: Object, name: 'object' };
    };

    return resolve({ type: root });
  }
}