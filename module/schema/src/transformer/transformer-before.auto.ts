import * as ts from 'typescript';
import { Schema, Ignore, Field } from '../decorate';
import { Messages } from '../util';
import { TransformUtil, Import } from '@encore/base';

type DecList = ts.NodeArray<ts.Decorator>;
type SchemaList = (ts.Expression | undefined)[];

interface State {
  imports: Import[],
  path: string,
  inAuto: boolean,
  addField: ts.Node | undefined
}

export const Transformer =
  (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => {
      let state: State = { imports: [], path: require.resolve(file.fileName), inAuto: false, addField: undefined };
      let ret = visitNode(context, file, state);

      if (state.imports.length) {
        TransformUtil.addImport(ret, state.imports);
      }
      return ret;
    };

function importIfExternal(node: ts.Node, state: State) {
  let { path, name: declName, ident: decl } = TransformUtil.getTypeInfoForNode(node);
  let ident = ts.createIdentifier(declName);
  let importName = ts.createUniqueName(`import_${declName}`);

  let finalTarget: ts.Expression = ident;

  if (require.resolve(path) !== state.path) {
    state.imports.push({
      ident: importName,
      path
    });

    finalTarget = ts.createPropertyAccess(importName, ident);
  }
  return finalTarget;
}

function resolveType(type: ts.Node, state: State): ts.Expression {
  let expr: ts.Expression | undefined;
  let kind = type && type!.kind;

  switch (kind) {
    case ts.SyntaxKind.TypeReference:
      expr = ((type as ts.TypeReferenceNode).typeName) as ts.Expression;
      expr = importIfExternal(expr, state);
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

function computeProperty(node: ts.PropertyDeclaration, state: State) {
  let ignore = TransformUtil.getDecorator(node, require.resolve('../decorators'), 'Ignore');

  if (!ignore && state.inAuto) {
    let typeExpr = resolveType(node.type!, state);
    let properties = [];
    if (!node.questionToken) {
      properties.push(ts.createPropertyAssignment('required', TransformUtil.fromLiteral([true, Messages.REQUIRED])));
    }

    // If we have a union type
    if (node.type!.kind === ts.SyntaxKind.UnionType && ['Number', 'String'].indexOf((typeExpr as any).text) > 0) {

      let types = (node.type! as ts.UnionTypeNode).types
      let literals = types.map(x => (x as ts.LiteralTypeNode).literal);
      let values = literals.map(x => x.getText());

      properties.push(ts.createPropertyAssignment('enum', TransformUtil.fromLiteral({
        values: literals,
        message: `{PATH} is only allowed to be "${values.join('" or "')}"`
      })));
    }

    let params = [typeExpr];
    if (properties.length) {
      params.push(ts.createObjectLiteral(properties));
    }

    if (!state.addField) {
      let ident = ts.createUniqueName('import_Field');
      state.imports.push({
        path: require.resolve('../decorate'),
        ident
      });
      state.addField = ts.createPropertyAccess(ident, 'Field');
    }

    let dec = ts.createDecorator(ts.createCall(state.addField as any, undefined, params));
    let res = ts.updateProperty(node,
      ts.createNodeArray([...(node.decorators! || []), dec]),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
    return res;
  } else {
    return node;
  }
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: State): T {
  if (ts.isClassDeclaration(node)) {
    let schema = TransformUtil.getDecorator(node, require.resolve('../decorator/schema'), 'Schema');
    let arg = TransformUtil.getPrimaryArgument<ts.LiteralExpression>(schema);
    let auto = (arg && arg.text === 'true') || false;
    let ret = ts.visitEachChild(node, c => visitNode(context, c, { ...state, inAuto: auto }), context);
    return ret;
  } else if (ts.isPropertyDeclaration(node) && !!state.inAuto) {
    return computeProperty(node, state) as any as T;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

