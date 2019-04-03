import * as ts from 'typescript';

import { TransformUtil, TransformerState } from '@travetto/compiler';
import { ConfigSource } from '@travetto/config';

const SCHEMAS = TransformUtil.buildImportAliasMap({
  ...ConfigSource.get('registry.schema'),
  '@travetto/schema': 'Schema'
});

interface AutoState extends TransformerState {
  inAuto: boolean;
}

function computeProperty(state: AutoState, node: ts.PropertyDeclaration) {

  const typeExpr = TransformUtil.resolveType(state, node.type!);
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

  const dec = TransformUtil.createDecorator(state, require.resolve('../src/decorator/field'), 'Field', ...params);
  const newDecs = [...(node.decorators || []), dec];

  const comments = TransformUtil.describeByComments(state, node);
  if (comments.description) {
    newDecs.push(TransformUtil.createDecorator(state, require.resolve('../src/decorator/common'), 'Describe', TransformUtil.fromLiteral({
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

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: AutoState): T {

  if (ts.isClassDeclaration(node)) {
    const anySchema = TransformUtil.findAnyDecorator(state, node, SCHEMAS);

    const schema = TransformUtil.findAnyDecorator(state, node, {
      Schema: new Set(['@travetto/schema'])
    });

    let auto = !!anySchema;

    if (!!schema) {
      const arg = TransformUtil.getPrimaryArgument<ts.LiteralExpression>(schema);
      auto = (!arg || arg.kind !== ts.SyntaxKind.FalseKeyword);
    }

    if (auto) {
      state.inAuto = true;
      const ret = ts.visitEachChild(node, c => visitNode(context, c, state), context) as ts.ClassDeclaration;
      state.inAuto = false;
      for (const member of ret.members || []) {
        if (!member.parent) {
          member.parent = ret;
        }
      }
      node = ret as any as T;
    }

    if (!!anySchema) {
      const ret = node as any as ts.ClassDeclaration;
      const decls = [...(node.decorators || [])];

      const comments = TransformUtil.describeByComments(state, node);

      if (!schema) {
        decls.unshift(TransformUtil.createDecorator(state, require.resolve('../src/decorator/schema'), 'Schema'));
      }

      if (comments.description) {
        decls.push(TransformUtil.createDecorator(state, require.resolve('../src/decorator/common'), 'Describe', TransformUtil.fromLiteral({
          title: comments.description
        })));
      }

      const out = ts.updateClassDeclaration(
        ret,
        ts.createNodeArray(decls),
        ret.modifiers,
        ret.name,
        ret.typeParameters,
        ts.createNodeArray(ret.heritageClauses),
        ret.members
      ) as any;

      out.parent = node.parent;

      for (const el of out.members) {
        if (!el.parent) {
          el.parent = out;
        }
      }

      node = out;
    }

    return node;
    // tslint:disable-next-line:no-bitwise
  } else if (ts.isPropertyDeclaration(node) && !(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static)) {
    if (state.inAuto) {
      const ignore = TransformUtil.findAnyDecorator(state, node, { Ignore: new Set(['@travetto/schema']) });
      if (!ignore) {
        return computeProperty(state, node) as any as T;
      }
    }
    return node;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

export const SchemaTransformer = {
  transformer: TransformUtil.importingVisitor<AutoState>(() => ({
    inAuto: false
  }), visitNode),
  key: 'schema',
  after: 'registry',
  phase: 'before'
};