import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta, res
} from '@travetto/compiler/src/transform-support';

const inAuto = Symbol('inAuto');
const hasSchema = Symbol('hasSchema');

interface AutoState {
  [inAuto]?: boolean;
  [hasSchema]?: boolean;
}

const SCHEMA_MOD = require.resolve('../src/decorator/schema');
const FIELD_MOD = require.resolve('../src/decorator/field');

export class SchemaTransformer {

  // TODO: Full rewrite
  static computeProperty(state: AutoState & TransformerState, node: ts.PropertyDeclaration) {

    const typeExpr = state.resolveType(node);
    const properties = [];

    if (!node.questionToken && !typeExpr.undefinable) {
      properties.push(ts.createPropertyAssignment('required', TransformUtil.fromLiteral({ active: true })));
    }

    // If we have a union type
    if (res.isUnionType(typeExpr)) {
      const values = typeExpr.unionTypes.map(x => res.isRealType(x) ? x.value : undefined);

      properties.push(ts.createPropertyAssignment('enum', TransformUtil.fromLiteral({
        values,
        message: `{path} is only allowed to be "${values.join('" or "')}"`
      })));
    }

    const params = [];
    if (properties.length) {
      params.push(ts.createObjectLiteral(properties));
    }

    state.importDecorator(require.resolve('../src/decorator/field'), 'Field');

    const dec = state.createDecorator('Field', ...params);
    const newDecs = [...(node.decorators || []), dec];

    const comments = state.readJSDocs(node);
    if (comments.description) {
      state.importDecorator(require.resolve('../src/decorator/common'), 'Describe');

      newDecs.push(state.createDecorator('Describe', TransformUtil.fromLiteral({
        description: comments.description
      })));
    }

    const result = ts.updateProperty(node,
      ts.createNodeArray(newDecs),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );

    return result;
  }

  @OnClass('trv/schema/Schema')
  static handleClassBefore(state: AutoState & TransformerState, node: ts.ClassDeclaration, dec?: DecoratorMeta) {
    if (!dec) {
      return node;
    }

    const schema = state.findDecorator(node, 'trv/schema/Schema', 'Schema', SCHEMA_MOD);
    let auto = !!schema;

    state[hasSchema] = !!schema;

    if (schema) { // Handle schema specific
      const arg = TransformUtil.getPrimaryArgument<ts.LiteralExpression>(schema);
      auto = (!arg || arg.kind !== ts.SyntaxKind.FalseKeyword);
    }

    state[inAuto] = auto;
    return node;
  }

  @AfterClass('trv/schema/Schema')
  static handleClassAfter(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators || [])];

    const comments = state.readJSDocs(node);

    if (!state[hasSchema]) {
      state.importDecorator(require.resolve('../src/decorator/schema'), 'Schema');
      decls.unshift(state.createDecorator('Schema'));
    }

    if (comments.description) {
      state.importDecorator(require.resolve('../src/decorator/common'), 'Describe');
      decls.push(state.createDecorator('Describe', TransformUtil.fromLiteral({
        title: comments.description
      })));
    }

    delete state[hasSchema];
    delete state[inAuto];

    return ts.updateClassDeclaration(
      node,
      ts.createNodeArray(decls),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      node.members
    );
  }

  @OnProperty()
  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    if (state[inAuto]) {
      const ignore = state.findDecorator(node, 'trv/schema/Ignore', 'Ignore', FIELD_MOD);
      if (!ignore) {
        return this.computeProperty(state, node);
      }
    }
    return node;
  }
}