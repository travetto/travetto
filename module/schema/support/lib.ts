import * as ts from 'typescript';
import { AnyType, DocUtil, ParamDocumentation, TransformerState } from '@travetto/transformer';

const SCHEMA_MOD = '@travetto/schema/src/decorator/schema';
const FIELD_MOD = '@travetto/schema/src/decorator/field';
const COMMON_MOD = '@travetto/schema/src/decorator/common';

export class SchemaTransformUtil {

  /**
   * Produce concrete type given transformer type
   */
  static toConcreteType(state: TransformerState, type: AnyType, node: ts.Node, root: ts.Node = node): ts.Expression {
    switch (type.key) {
      case 'pointer': return this.toConcreteType(state, type.target, node, root);
      case 'external': return state.getOrImport(type);
      case 'tuple': return state.fromLiteral(type.subTypes.map(x => this.toConcreteType(state, x, node, root)!));
      case 'literal': {
        if ((type.ctor === Array || type.ctor === Set) && type.typeArguments?.length) {
          return state.fromLiteral([this.toConcreteType(state, type.typeArguments[0], node, root)]);
        } else if (type.ctor) {
          return state.createIdentifier(type.ctor.name!);
        }
        break;
      }
      case 'shape': {
        const uniqueId = state.generateUniqueIdentifier(node, type);

        // Build class on the fly
        const [id, existing] = state.createSyntheticIdentifier(uniqueId);
        if (!existing) {
          const cls = state.factory.createClassDeclaration(
            [
              state.createDecorator(SCHEMA_MOD, 'Schema'),
              state.createDecorator(COMMON_MOD, 'Describe',
                state.fromLiteral({
                  title: type.name,
                  description: type.comment
                })
              )
            ],
            [], id, [], [],
            Object.entries(type.fieldTypes).map(([k, v]) =>
              this.computeField(state, state.factory.createPropertyDeclaration(
                [], [], k,
                v.undefinable || v.nullable ? state.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                undefined, undefined
              ), { type: v, root })
            )
          );
          cls.getText = () => '';
          state.addStatement(cls, root || node);
        }
        return id;
      }
      case 'union': {
        if (type.commonType) {
          return this.toConcreteType(state, type.commonType, node, root);
        }
      }
    }
    return state.createIdentifier('Object');
  }

  /**
   * Compute property information from declaration
   */
  static computeField<T extends ts.PropertyDeclaration | ts.ParameterDeclaration>(
    state: TransformerState, node: T, config: { type?: AnyType, root?: ts.Node, name?: string } = { root: node }
  ): T {

    const typeExpr = config.type ?? state.resolveType(node);
    const attrs: ts.PropertyAssignment[] = [];

    if (!node.questionToken && !typeExpr.undefinable && !node.initializer) {
      attrs.push(state.factory.createPropertyAssignment('required', state.fromLiteral({ active: true })));
    }

    if (ts.isParameter(node) || config.name !== undefined) {
      attrs.push(state.factory.createPropertyAssignment('name', state.factory.createStringLiteral(
        config.name !== undefined ? config.name : node.name.getText())
      ));
    }

    if (node.initializer && ts.isLiteralExpression(node.initializer)) {
      attrs.push(state.factory.createPropertyAssignment('default', node.initializer));
    }

    // If we have a union type
    if (typeExpr.key === 'union') {
      const values = typeExpr.subTypes.map(x => x.key === 'literal' ? x.value : undefined)
        .filter(x => x !== undefined && x !== null);

      if (values.length === typeExpr.subTypes.length) {
        attrs.push(state.factory.createPropertyAssignment('enum', state.fromLiteral({
          values,
          message: `{path} is only allowed to be "${values.join('" or "')}"`
        })));
      }
    }

    const resolved = this.toConcreteType(state, typeExpr, node, config.root);
    const params: ts.Expression[] = resolved ? [resolved] : [];

    if (ts.isParameter(node)) {
      const comments = DocUtil.describeDocs(node.parent);
      const commentConfig = (comments.params ?? []).find(x => x.name === node.name.getText()) || {} as Partial<ParamDocumentation>;
      if (commentConfig.description) {
        attrs.push(state.factory.createPropertyAssignment('description', state.fromLiteral(commentConfig.description)));
      }
      if (attrs.length) {
        params.push(state.factory.createObjectLiteralExpression(attrs));
      }
    }

    const dec = state.createDecorator(FIELD_MOD, 'Field', ...params);
    const newDecs = [...(node.decorators ?? []), dec];

    if (ts.isPropertyDeclaration(node)) {
      const comments = DocUtil.describeDocs(node);
      if (comments.description) {
        newDecs.push(state.createDecorator(COMMON_MOD, 'Describe', state.fromLiteral({
          description: comments.description
        })));
      }

      return state.factory.updatePropertyDeclaration(node as Exclude<typeof node, T>,
        newDecs,
        node.modifiers,
        node.name,
        node.questionToken,
        node.type,
        node.initializer
      ) as T;
    } else {
      return state.factory.updateParameterDeclaration(node as Exclude<typeof node, T>,
        newDecs,
        node.modifiers,
        node.dotDotDotToken,
        node.name,
        node.questionToken,
        node.type,
        node.initializer
      ) as T;
    }
  }
}