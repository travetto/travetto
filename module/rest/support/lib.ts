import * as ts from 'typescript';
import { AnyType, DeclarationUtil, DeclDocumentation, ParamDocumentation, TransformerState } from '@travetto/transformer';
import { LiteralType, ShapeType } from '@travetto/transformer/src/resolver/types';
import { SchemaTransformUtil } from '@travetto/schema/support/lib'; // @line-if @travetto/schema

import { ParamConfig } from '../src/types';

/* // @line-if !@travetto/schema
const SchemaTransformUtil = undefined;
*/ // @line-if !@travetto/schema

/**
 * Support tools for transforming rest endpoints
 */
export class RestTransformUtil {
  /**
   * Get base parameter config
   */
  static getParameterConfig(state: TransformerState, node: ts.ParameterDeclaration, comments: DeclDocumentation): Partial<ParamConfig> {
    const pName = node.name.getText();

    const decConfig: Partial<ParamConfig> = { name: pName };
    const commentConfig = (comments.params ?? []).find(x => x.name === decConfig.name) || {} as Partial<ParamDocumentation>;

    return {
      description: decConfig.name!,
      defaultValue: node.initializer,
      ...commentConfig,
      ...decConfig,
      required: !(node.questionToken || node.initializer)
    };
  }

  /**
   * Compute the parameter type
   */
  static getParameterType(state: TransformerState, node: ts.ParameterDeclaration) {

    let paramType = state.resolveType(node);
    let array = false;
    let defaultType = 'Query';

    switch (paramType.key) {
      case 'literal': {
        array = paramType.ctor === Array;
        if (array) {
          paramType = paramType.typeArguments?.[0] ?? { key: 'literal', ctor: Object, name: 'object' };
        }
        break;
      }
      // White list pointer types as context
      case 'external': defaultType = 'Context'; break;
      case 'union': paramType = { key: 'literal', ctor: Object, name: 'object' };
    }

    const type = state.typeToIdentifier(paramType)!;
    return { array, type, defaultType };
  }

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
      // TODO: fix direct access to resolver
      const props = state['resolver'].getPropertiesOfType(cls);
      for (const prop of props) {
        const decl = prop.declarations[0];
        if (prop.escapedName === 'render' && ts.isMethodDeclaration(decl)) {
          render = decl;
        }
      }
    }

    if (render && ts.isMethodDeclaration(render)) {
      const typeNode = ts.getJSDocReturnType(render);
      if (typeNode) {
        // TODO: fix direct access to tsChecker
        const resolved = state['resolver']['tsChecker'].getTypeFromTypeNode(typeNode);
        return state.resolveType(resolved);
      } else {
        throw new Error('All Renderable outputs must declare a @returns type on the render method');
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
    retType = retType || state.resolveReturnType(node);

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
        type.type = this.toConcreteType(state, retType, node);
        break;
      }
      case 'literal': {
        if (retType.ctor) {
          if (type.array) {
            type.type = state.factory.createArrayLiteralExpression([this.toConcreteType(state, retType, node)]);
          } else {
            type.type = state.factory.createIdentifier(retType.ctor.name);
          }
        }
      }
    }

    return type;
  }

  /**
   * Provide concrete type for literal/shape types, relies on @travetot/schema
   */
  static toConcreteType(state: TransformerState, type: LiteralType | ShapeType, node: ts.Node, root: ts.Node = node): ts.Expression {
    if (SchemaTransformUtil) {
      return SchemaTransformUtil.toConcreteType(state, type, node, root);
    } else {
      console.warn('Interface/shape types are not supported by default, please install @travetto/schema to allow for their usage');
      return state.factory.createIdentifier('Object');
    }
  }
}