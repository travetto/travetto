import * as ts from 'typescript';
import { AnyType, DocUtil, TransformerState } from '@travetto/transformer';
import { Util } from '@travetto/base';

const SCHEMA_MOD = require.resolve('../src/decorator/schema');
const FIELD_MOD = require.resolve('../src/decorator/field');
const COMMON_MOD = require.resolve('../src/decorator/common');

export class SchemaTransformUtil {

  /**
   * Produce concrete type given transformer type
   */
  static toConcreteType(state: TransformerState, type: AnyType, node: ts.Node, root: ts.Node = node): ts.Expression {
    switch (type.key) {
      case 'pointer': return this.toConcreteType(state, type.target, node, root);
      case 'external': {
        const res = state.getOrImport(type);
        return res;
      }
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
        // Determine type name
        let name = type.name && !type.name.startsWith('_') ? type.name : '';
        if (!name && (node as any).name?.escapedText) {
          name = `${(node as any).name.escapedText}`;
        }
        // Determine type unique ident
        let unique: string = Util.uuid(type.name ? 5 : 10);
        try {
          unique = `${ts.getLineAndCharacterOfPosition(state.source, node.getStart()).line}_${node.getEnd() - node.getStart()}`;
        } catch { }

        // Build class on the fly
        const id = state.createIdentifier(`${name}_${unique}ᚕsyn`);
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
            this.computeProperty(state, state.factory.createPropertyDeclaration(
              [], [], k,
              v.undefinable || v.nullable ? state.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
              undefined, undefined
            ), v, root)
          )
        );
        cls.getText = () => '';
        state.addStatement(cls, root || node);
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
  static computeProperty<T extends ts.PropertyDeclaration>(state: TransformerState, node: T, type?: AnyType, root: ts.Node = node): T {

    const typeExpr = type || state.resolveType(node);
    const properties = [];

    if (!node.questionToken && !typeExpr.undefinable && !node.initializer) {
      properties.push(state.factory.createPropertyAssignment('required', state.fromLiteral({ active: true })));
    }

    // If we have a union type
    if (typeExpr.key === 'union') {
      const values = typeExpr.subTypes.map(x => x.key === 'literal' ? x.value : undefined)
        .filter(x => x !== undefined && x !== null);

      if (values.length === typeExpr.subTypes.length) {
        properties.push(state.factory.createPropertyAssignment('enum', state.fromLiteral({
          values,
          message: `{path} is only allowed to be "${values.join('" or "')}"`
        })));
      }
    }

    const resolved = this.toConcreteType(state, typeExpr, node, root);
    const params: ts.Expression[] = resolved ? [resolved] : [];

    if (properties.length) {
      params.push(state.factory.createObjectLiteralExpression(properties));
    }

    const dec = state.createDecorator(FIELD_MOD, 'Field', ...params);
    const newDecs = [...(node.decorators ?? []), dec];

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
  }
}