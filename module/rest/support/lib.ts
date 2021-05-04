import * as ts from 'typescript';

import { AnyType, DeclarationUtil, TransformerState } from '@travetto/transformer';
import { SchemaTransformUtil } from '@travetto/schema/support/lib';

/**
 * Support tools for transforming rest endpoints
 */
export class RestTransformUtil {

  /**
   * Find the render method of a type if provided
   * @param state
   * @param cls
   */
  static findRenderMethod(state: TransformerState, cls: ts.ClassLikeDeclaration | ts.Type): AnyType | undefined {
    let render;
    if ('getSourceFile' in cls) {
      render = cls.members.find(
        m => ts.isMethodDeclaration(m) && ts.isIdentifier(m.name) && m.name.escapedText === 'render'
      );
    } else {
      const props = state.getResolver().getPropertiesOfType(cls);
      for (const prop of props) {
        const decl = prop.declarations?.[0];
        if (decl && prop.escapedName === 'render' && ts.isMethodDeclaration(decl)) {
          render = decl;
        }
      }
    }

    if (render && ts.isMethodDeclaration(render)) {
      const typeNode = ts.getJSDocReturnType(render);
      if (typeNode) {
        const resolved = state.getResolver().getChecker().getTypeFromTypeNode(typeNode);
        return state.resolveType(resolved);
      } else {
        return state.resolveReturnType(render);
      }
    }
  }

  /**
   * Resolve method return type
   * @param state
   * @param node
   */
  static resolveReturnType(state: TransformerState, node: ts.MethodDeclaration, retType?: AnyType): Record<string, unknown> {

    // Process returnType
    retType ??= state.resolveReturnType(node);

    // IF we have a winner, declare response type
    const type: Record<string, unknown> = {};

    while (retType?.key === 'literal' && retType.typeArguments?.length) {
      if (retType.ctor === Array || retType.ctor === Set) {
        type.array = true;
      }
      retType = retType.typeArguments?.[0] ?? { key: 'literal', ctor: Object }; // We have a promise nested
    }

    switch (retType?.key) {
      case 'external': {
        const ext = retType;
        const [cls] = DeclarationUtil.getDeclarations(retType.original!);
        if (cls && ts.isClassDeclaration(cls)) {
          const renderReturn = this.findRenderMethod(state, cls);
          if (renderReturn) {
            return this.resolveReturnType(state, node, renderReturn);
          }
        }
        type.type = state.typeToIdentifier(ext);
        break;
      }
      case 'shape': {
        if (retType.original) {
          const renderReturn = this.findRenderMethod(state, retType.original);
          if (renderReturn) {
            return this.resolveReturnType(state, node, renderReturn);
          }
        }
        type.type = SchemaTransformUtil.toConcreteType(state, retType, node);
        break;
      }
      case 'literal': {
        if (retType.ctor) {
          if (type.array) {
            type.type = SchemaTransformUtil.toConcreteType(state, retType, node);
          } else {
            type.type = state.factory.createIdentifier(retType.ctor.name);
          }
        }
      }
    }

    return type;
  }
}