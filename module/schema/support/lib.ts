import * as ts from 'typescript';
import { AnyType, LiteralUtil, DocUtil, TransformerState } from '@travetto/transformer';
import { Util } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';

const SCHEMA_MOD = require.resolve('../src/decorator/schema');
const FIELD_MOD = require.resolve('../src/decorator/field');
const COMMON_MOD = require.resolve('../src/decorator/common');

export class SchemaTransformUtil {

  /**
   * Produce final type given transformer type
   */
  static toFinalType(state: TransformerState, type: AnyType, node: ts.Node, root: ts.Node = node): ts.Expression {
    switch (type.key) {
      case 'pointer': return this.toFinalType(state, type.target, node, root);
      case 'external': {
        const res = state.getOrImport(type);
        return res;
      }
      case 'tuple': return LiteralUtil.fromLiteral(type.subTypes.map(x => this.toFinalType(state, x, node, root)!));
      case 'literal': {
        if ((type.ctor === Array || type.ctor === Set) && type.typeArguments?.length) {
          return LiteralUtil.fromLiteral([this.toFinalType(state, type.typeArguments[0], node, root)]);
        } else if (type.ctor) {
          return ts.createIdentifier(type.ctor.name!);
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
        const id = ts.createIdentifier(`${name}_${unique}ᚕsyn`);
        const cls = ts.createClassDeclaration(
          [
            state.createDecorator(SCHEMA_MOD, 'Schema'),
            state.createDecorator(COMMON_MOD, 'Describe',
              LiteralUtil.fromLiteral({
                title: type.name,
                description: type.comment
              })
            )
          ],
          [], id, [], [],
          Object.entries(type.fieldTypes).map(([k, v]) =>
            this.computeProperty(state, ts.createProperty(
              [], [], k,
              v.undefinable || v.nullable ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
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
          return this.toFinalType(state, type.commonType, node, root);
        }
      }
    }
    return ts.createIdentifier('Object');
  }


  /**
   * Compute property information from declaration
   */
  static computeProperty<T extends ts.PropertyDeclaration>(state: TransformerState, node: T, type?: AnyType, root: ts.Node = node): T {

    const typeExpr = type || state.resolveType(node);
    const properties = [];

    if (!node.questionToken && !typeExpr.undefinable && !node.initializer) {
      properties.push(ts.createPropertyAssignment('required', LiteralUtil.fromLiteral({ active: true })));
    }

    // If we have a union type
    if (typeExpr.key === 'union') {
      const values = typeExpr.subTypes.map(x => x.key === 'literal' ? x.value : undefined)
        .filter(x => x !== undefined && x !== null);

      if (values.length === typeExpr.subTypes.length) {
        properties.push(ts.createPropertyAssignment('enum', LiteralUtil.fromLiteral({
          values,
          message: `{path} is only allowed to be "${values.join('" or "')}"`
        })));
      }
    }

    const resolved = this.toFinalType(state, typeExpr, node, root);
    const params: ts.Expression[] = resolved ? [resolved] : [];

    if (properties.length) {
      params.push(ts.createObjectLiteral(properties));
    }

    const dec = state.createDecorator(FIELD_MOD, 'Field', ...params);
    const newDecs = [...(node.decorators ?? []), dec];

    const comments = DocUtil.describeDocs(node);
    if (comments.description) {
      newDecs.push(state.createDecorator(COMMON_MOD, 'Describe', LiteralUtil.fromLiteral({
        description: comments.description
      })));
    }

    return ts.updateProperty(node as Exclude<typeof node, T>,
      ts.createNodeArray(newDecs),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    ) as T;
  }
}