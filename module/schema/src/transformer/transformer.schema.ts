import * as ts from 'typescript';
import { Schema, Ignore, Field } from '../decorator';
import { TransformUtil, Import, State } from '@encore2/compiler';
import { ConfigLoader } from '@encore2/config';


let SCHEMAS = TransformUtil.buildImportAliasMap({
  ...ConfigLoader.get('registry.schema'),
  '@encore2/schema': 'Schema'
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
  let kind = type && type!.kind;

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
      let properties: ts.PropertyAssignment[] = [];
      for (let member of (type as ts.TypeLiteralNode).members) {
        let subMember: ts.TypeNode = (member as any).type;
        if ((subMember as any).literal) {
          subMember = (subMember as any).literal;
        }
        properties.push(ts.createPropertyAssignment(member.name as ts.Identifier, resolveType(subMember, state)))
      }
      expr = ts.createObjectLiteral(properties);
      break;
    case ts.SyntaxKind.UnionType: {
      let types = (type as ts.UnionTypeNode).types;
      expr = types.slice(1).reduce((fType, stype) => {
        let fTypeStr = (fType as any).text;
        if (fTypeStr !== 'Object') {
          let resolved = resolveType(stype, state);
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
  let typeExpr = resolveType(node.type!, state);
  let properties = [];
  if (!node.questionToken) {
    properties.push(ts.createPropertyAssignment('required', TransformUtil.fromLiteral({})));
  }

  // If we have a union type
  if (node.type && node.type!.kind === ts.SyntaxKind.UnionType && ['Number', 'String'].includes((typeExpr as any).text)) {

    let types = (node.type! as ts.UnionTypeNode).types
    let literals = types.map(x => (x as ts.LiteralTypeNode).literal);
    let values = literals.map(x => x.getText());

    properties.push(ts.createPropertyAssignment('enum', TransformUtil.fromLiteral({
      values: literals,
      message: `{path} is only allowed to be "${values.join('" or "')}"`
    })));
  }

  let params = [typeExpr];
  if (properties.length) {
    params.push(ts.createObjectLiteral(properties));
  }

  if (!state.addField) {
    let ident = ts.createUniqueName('import_Field');
    state.addField = ts.createPropertyAccess(ident, 'Field');
    state.newImports.push({
      path: require.resolve('../decorator/field'),
      ident
    });
  }

  let dec = ts.createDecorator(ts.createCall(state.addField as any, undefined, ts.createNodeArray(params)));
  let decls = ts.createNodeArray([
    dec, ...(node.decorators || [])
  ]);
  let res = ts.updateProperty(node,
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
    let anySchema = TransformUtil.findAnyDecorator(node, SCHEMAS, state);

    let schema = TransformUtil.findAnyDecorator(node, {
      'Schema': new Set(['@encore2/schema'])
    }, state);

    let auto = !!anySchema;

    if (!!schema) {
      let arg = TransformUtil.getPrimaryArgument<ts.LiteralExpression>(schema);
      auto = (!arg || arg.kind !== ts.SyntaxKind.FalseKeyword);
    }

    if (auto) {
      state.inAuto = true;
      let ret = ts.visitEachChild(node, c => visitNode(context, c, state), context) as ts.ClassDeclaration;
      state.inAuto = false;
      for (let member of ret.members || []) {
        if (!member.parent) {
          member.parent = ret;
        }
      }
      node = ret as any as T;
    }

    if (!!anySchema) {
      let ret = node as any as ts.ClassDeclaration;
      let decls = node.decorators;
      if (!schema) {
        if (!state.addSchema) {
          let ident = ts.createUniqueName('import_Schema');
          state.newImports.push({
            path: require.resolve('../decorator/schema'),
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
      let ignore = TransformUtil.findAnyDecorator(node, { Ignore: new Set(['@encore2/schema']) }, state);
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