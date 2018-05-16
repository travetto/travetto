import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@travetto/compiler';
import { ConfigLoader } from '@travetto/config';
import { Schema, Ignore, Field } from '../src/decorator';

const SCHEMAS = TransformUtil.buildImportAliasMap({
  ...ConfigLoader.get('registry.schema'),
  '@travetto/schema': 'Schema'
});

type DecList = ts.NodeArray<ts.Decorator>;
type SchemaList = (ts.Expression | undefined)[];

interface AutoState extends State {
  inAuto: boolean,
  addField: ts.Expression | undefined,
  addSchema: ts.Expression | undefined
}

function resolveType(type: ts.Node, state: State): ts.Expression {
  let expr: ts.Expression | undefined;
  const kind = type && type!.kind;

  switch (kind) {
    case ts.SyntaxKind.TypeReference:
      expr = TransformUtil.importIfExternal(type as ts.TypeReferenceNode, state);
      break;
    case ts.SyntaxKind.LiteralType: expr = resolveType((type as any as ts.LiteralTypeNode).literal, state); break;
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.StringKeyword: expr = ts.createIdentifier('String'); break;
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.NumberKeyword: expr = ts.createIdentifier('Number'); break;
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.BooleanKeyword: expr = ts.createIdentifier('Boolean'); break;
    case ts.SyntaxKind.ArrayType:
      expr = ts.createArrayLiteral([resolveType((type as ts.ArrayTypeNode).elementType, state)]);
      break;
    case ts.SyntaxKind.TypeLiteral:
      const properties: ts.PropertyAssignment[] = [];
      for (const member of (type as ts.TypeLiteralNode).members) {
        let subMember: ts.TypeNode = (member as any).type;
        if ((subMember as any).literal) {
          subMember = (subMember as any).literal;
        }
        properties.push(ts.createPropertyAssignment(member.name as ts.Identifier, resolveType(subMember, state)))
      }
      expr = ts.createObjectLiteral(properties);
      break;
    case ts.SyntaxKind.UnionType: {
      const types = (type as ts.UnionTypeNode).types;
      expr = types.slice(1).reduce((fType, stype) => {
        const fTypeStr = (fType as any).text;
        if (fTypeStr !== 'Object') {
          const resolved = resolveType(stype, state);
          if ((resolved as any).text !== fTypeStr) {
            fType = ts.createIdentifier('Object');
          }
        }
        return fType;
      }, resolveType(types[0], state));
      break;
    }
    case ts.SyntaxKind.ObjectKeyword:
    default:
      break;
  }
  return expr || ts.createIdentifier('Object');
}

function computeProperty(node: ts.PropertyDeclaration, state: AutoState) {
  const typeExpr = resolveType(node.type!, state);
  const properties = [];
  if (!node.questionToken) {
    properties.push(ts.createPropertyAssignment('required', TransformUtil.fromLiteral({})));
  }

  // If we have a union type
  if (node.type && node.type!.kind === ts.SyntaxKind.UnionType && ['Number', 'String'].includes((typeExpr as any).text)) {

    const types = (node.type! as ts.UnionTypeNode).types
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

  if (!state.addField) {
    const ident = ts.createUniqueName('import_Field');
    state.addField = ts.createPropertyAccess(ident, 'Field');
    state.newImports.push({
      path: require.resolve('../src/decorator/field'),
      ident
    });
  }

  const dec = ts.createDecorator(ts.createCall(state.addField as any, undefined, ts.createNodeArray(params)));
  const decls = ts.createNodeArray([
    dec, ...(node.decorators || [])
  ]);
  const res = ts.updateProperty(node,
    decls,
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
    const anySchema = TransformUtil.findAnyDecorator(node, SCHEMAS, state);

    const schema = TransformUtil.findAnyDecorator(node, {
      Schema: new Set(['@travetto/schema'])
    }, state);

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
      let decls = node.decorators;
      if (!schema) {
        if (!state.addSchema) {
          const ident = ts.createUniqueName('import_Schema');
          state.newImports.push({
            path: require.resolve('../src/decorator/schema'),
            ident
          });
          state.addSchema = ts.createPropertyAccess(ident, 'Schema');
        }

        decls = ts.createNodeArray([
          ts.createDecorator(ts.createCall(state.addSchema, undefined, ts.createNodeArray([]))),
          ...(decls || [])
        ])
      }

      node = ts.updateClassDeclaration(
        ret,
        decls,
        ret.modifiers,
        ret.name,
        ret.typeParameters,
        ts.createNodeArray(ret.heritageClauses),
        ret.members
      ) as any
    }

    return node;
    // tslint:disable-next-line:no-bitwise
  } else if (ts.isPropertyDeclaration(node) && !(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static)) {
    if (state.inAuto) {
      const ignore = TransformUtil.findAnyDecorator(node, { Ignore: new Set(['@travetto/schema']) }, state);
      if (!ignore) {
        return computeProperty(node, state) as any as T;
      }
    }
    return node;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

export const SchemaTransformer = {
  transformer: TransformUtil.importingVisitor<AutoState>(() => ({
    inAuto: false,
    addField: undefined
  }), visitNode),
  phase: 'before'
};