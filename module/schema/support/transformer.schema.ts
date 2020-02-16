import * as ts from 'typescript';

import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

const IGNORE_CHECKER = TransformUtil.decoratorMatcher('schema-ignore');

const SCHEMA_CHECKER = TransformUtil.decoratorMatcher('schema');

const inAuto = Symbol('inAuto');
const hasSchema = Symbol('hasSchema');

interface AutoState {
  [inAuto]?: boolean;
  [hasSchema]?: boolean;
}

class SchemaTransformer {

  // TODO: Full rewrite
  static computeProperty(state: AutoState & TransformerState, node: ts.PropertyDeclaration) {

    const typeExpr = state.checker.resolveType(node);
    const properties = [];
    const isUnion = node.type && node.type!.kind === ts.SyntaxKind.UnionType;

    if (!node.questionToken && !(isUnion && (node.type as ts.UnionTypeNode).types.find(x => x.kind === ts.SyntaxKind.UndefinedKeyword))) {
      properties.push(ts.createPropertyAssignment('required', TransformUtil.fromLiteral({ active: true })));
    }

    // If we have a union type
    if (isUnion && ['Number', 'String'].includes((typeExpr as any).text)) {

      const types = (node.type! as ts.UnionTypeNode).types;
      const literals = types.map(x => (x as ts.LiteralTypeNode).literal);
      const values = literals.map(x => x.getText());

      properties.push(ts.createPropertyAssignment('enum', TransformUtil.fromLiteral({
        values: literals,
        message: `{path} is only allowed to be "${values.join('" or "')}"`
      })));
    }

    const params = [typeExpr];
    if (properties.length) {
      params.push(ts.createObjectLiteral(properties));
    }

    state.importDecorator(require.resolve('../src/decorator/field'), 'Field');

    const dec = state.createDecorator('Field', ...params);
    const newDecs = [...(node.decorators || []), dec];

    const comments = state.checker.describeByJSDocs(node);
    if (comments.description) {
      state.importDecorator(require.resolve('../src/decorator/common'), 'Describe');

      newDecs.push(state.createDecorator('Describe', TransformUtil.fromLiteral({
        description: comments.description
      })));
    }

    const res = ts.updateProperty(node,
      ts.createNodeArray(newDecs),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );

    return res;
  }

  static handleClassBefore(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const schemas = SCHEMA_CHECKER(node, state.imports);
    const schema = schemas.get('Schema');

    let auto = !!schemas.size;

    state[hasSchema] = !!schema;

    if (schema) { // Handle schema specific
      const arg = TransformUtil.getPrimaryArgument<ts.LiteralExpression>(schema);
      auto = (!arg || arg.kind !== ts.SyntaxKind.FalseKeyword);
    }

    state[inAuto] = auto;
    return node;
  }

  static handleClassAfter(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators || [])];

    const comments = state.checker.describeByJSDocs(node);

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

  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    if (state[inAuto]) {
      const ignore = IGNORE_CHECKER(node, state.imports);
      if (!ignore.size) {
        return this.computeProperty(state, node);
      }
    }
    return node;
  }
}

export const transformers: NodeTransformer[] = [
  { type: 'property', all: true, before: SchemaTransformer.handleProperty.bind(SchemaTransformer) },
  {
    type: 'class', alias: 'trv/schema/Schema',
    before: SchemaTransformer.handleClassBefore.bind(SchemaTransformer),
    after: SchemaTransformer.handleClassAfter.bind(SchemaTransformer)
  }
];