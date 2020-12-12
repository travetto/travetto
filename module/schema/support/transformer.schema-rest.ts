import * as ts from 'typescript';

import { TransformerState, OnParameter, DecoratorMeta, OnMethod, DocUtil, DecoratorUtil, DeclarationUtil, AnyType, TransformerId } from '@travetto/transformer';
import { SchemaTransformUtil } from './lib';

const ENDPOINT_DEC_FILE = (() => { try { return require.resolve('@travetto/rest/src/decorator/endpoint'); } catch { } })()!;

/**
 * Processes `@SchemaBody` or `@SchemaQuery` to register interface types as a valid Schema
 *
 * Additionally adds return type info for endpoint methods
 */
export class SchemaRestTransformer {

  static [TransformerId] = '@trv:schema';

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
        throw new Error(`All Renderable outputs must declare a @returns type on the render method`);
      }
    }
  }

  /**
   * Resolve method return type
   * @param state
   * @param node
   */
  static resolveReturnType(state: TransformerState, node: ts.MethodDeclaration, retType?: AnyType): Record<string, any> {
    // Process returnType
    retType = retType || state.resolveReturnType(node);

    // IF we have a winner, declare response type
    const type: Record<string, any> = {};

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
          } else if (!state.getDecoratorList(cls).some(x => x.targets?.includes('@trv:schema/Schema'))) {
            throw new Error(`Class ${cls.name?.escapedText} is missing a @Schema decorator`);
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
        type.type = SchemaTransformUtil.toFinalType(state, retType, node) as ts.Identifier;
        break;
      }
      case 'literal': {
        if (retType.ctor) {
          type.type = SchemaTransformUtil.toFinalType(state, retType, node);
        }
      }
    }

    return type;
  }

  /**
   * Annotate return type
   */
  @OnMethod('@trv:rest/Endpoint')
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {
    // IF we have a winner, declare response type
    const type = this.resolveReturnType(state, node);

    if (type.type) {
      const decls = node.decorators || [];
      const comments = DocUtil.describeDocs(node);
      const produces = state.createDecorator(ENDPOINT_DEC_FILE, 'ResponseType', state.fromLiteral({
        ...type,
        title: comments.return
      }));
      return state.factory.updateMethodDeclaration(
        node,
        [...decls, produces],
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        node.parameters,
        node.type,
        node.body
      );
    } else {
      return node;
    }
  }

  /**
   * Handle all parameters that care about schema
   */
  @OnParameter('Param')
  static processEndpointParameterType(state: TransformerState, node: ts.ParameterDeclaration, dm?: DecoratorMeta) {
    const resolved = state.resolveType(node.type!);
    if (dm && resolved.key === 'shape') {
      const id = SchemaTransformUtil.toFinalType(state, resolved, node) as ts.Identifier;
      const extra = state.extendObjectLiteral({
        type: id
      });
      const primary = DecoratorUtil.getPrimaryArgument(dm.dec);
      return state.factory.updateParameterDeclaration(
        node,
        DecoratorUtil.spliceDecorators(
          node, dm.dec,
          [state.createDecorator(dm.file!, dm.name!, primary ? state.extendObjectLiteral(primary, extra) : extra)]
        ),
        node.modifiers,
        node.dotDotDotToken,
        node.name,
        node.questionToken,
        node.type,
        node.initializer
      );
    } else {
      return node;
    }
  }
}