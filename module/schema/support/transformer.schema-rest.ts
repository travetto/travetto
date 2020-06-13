import * as ts from 'typescript';

import { TransformerState, OnParameter, DecoratorMeta, LiteralUtil, OnMethod, DocUtil, DecoratorUtil } from '@travetto/transformer';
import { SchemaTransformUtil } from './lib';

const ENDPOINT_DEC_FILE = (() => { try { return require.resolve('@travetto/rest/src/decorator/endpoint'); } catch { } })()!;

/**
 * Processes `@SchemaBody` or `@SchemaQuery` to register interface types as a valid Schema
 *
 * Additionally adds return type info for endpoint methods
 */
export class SchemaRestTransformer {

  /**
   * Annotate return type
   */
  @OnMethod('@trv:rest/Endpoint')
  static handleEndpoint(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {
    const decls = node.decorators || [];
    const newDecls = [];

    const comments = DocUtil.describeDocs(node);

    // Process returnType
    let retType = state.resolveReturnType(node);

    if (retType.key === 'literal' && retType.ctor === Promise) {
      retType = retType.typeArguments?.[0] ?? { key: 'literal', ctor: Object }; // We have a promise nested
    }

    // IF we have a winner, declare response type
    if (retType) {
      const type: Record<string, any> = {
        type: retType
      };
      if (retType.key === 'literal' && (retType.ctor === Array || retType.ctor === Set)) {
        type.array = true;
        type.type = retType.typeArguments?.[0] ?? { key: 'literal', ctor: Object };
      }

      switch (type.type.key) {
        case 'external': type.type = state.typeToIdentifier(type.type); break;
        case 'shape': {
          const id = SchemaTransformUtil.toFinalType(state, retType, node) as ts.Identifier;
          type.type = id;
        }
      }

      const produces = state.createDecorator(ENDPOINT_DEC_FILE, 'ResponseType', LiteralUtil.fromLiteral({
        ...type,
        title: comments.return
      }));
      newDecls.push(produces);
    }

    if (newDecls.length) {
      return ts.updateMethod(
        node,
        [...decls, ...newDecls],
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
  @OnParameter('@trv:schema/Param')
  static handleProperty(state: TransformerState, node: ts.ParameterDeclaration, dm?: DecoratorMeta) {
    const resolved = state.resolveType(node.type!);
    if (dm && resolved.key === 'shape') {
      const id = SchemaTransformUtil.toFinalType(state, resolved, node) as ts.Identifier;
      const extra = LiteralUtil.extendObjectLiteral({
        type: id
      });
      const primary = DecoratorUtil.getPrimaryArgument(dm.dec);
      return ts.updateParameter(
        node,
        DecoratorUtil.spliceDecorators(
          node, dm.dec,
          [state.createDecorator(dm.file!, dm.name!, primary ? LiteralUtil.extendObjectLiteral(primary, extra) : extra)]
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