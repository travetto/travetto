import * as ts from 'typescript';
import { AutoSchema, Ignore } from './auto';
import { Field } from './field';
import { Messages } from '../util';

type DecList = ts.NodeArray<ts.Decorator>;
type SchemaList = (ts.Expression | undefined)[];

interface State {
  inSchema?: ts.Expression;
  declared: ts.Identifier[]
}

export const Transformer =
  (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => {
      let state: State = { declared: [] };
      let ret = visitNode(context, file, state);
      return ret;
    };

function getDecoratorIdent(d: ts.Decorator): ts.Identifier {
  if (ts.isCallExpression(d.expression)) {
    return d.expression.expression as ts.Identifier;
  } else if (ts.isIdentifier(d.expression)) {
    return d.expression;
  } else {
    throw new Error('No Identifier');
  }
}

function computeClass(node: ts.ClassDeclaration) {
  let decs = (node.decorators || [] as any as DecList).filter(d => !!d.expression);
  if (decs && decs.length) {
    let auto = decs
      .map(d => getDecoratorIdent(d))
      .find(d => d.getText() === AutoSchema.name);

    return auto;
  }
}

function resolveType(type: ts.Node, state: State): ts.Expression {
  let expr: ts.Expression | undefined;
  let kind = type && type!.kind;

  switch (kind) {
    case ts.SyntaxKind.TypeReference:
      expr = ((type as ts.TypeReferenceNode).typeName) as ts.Expression;
      state.declared.push(expr as ts.Identifier);
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
      expr = types.slice(1).reduce((fType, type) => {
        let fTypeStr = (fType as any).text;
        if (fTypeStr !== 'Object') {
          let resolved = resolveType(type, state);
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
  let ignore = (node.decorators || [] as any as DecList).find(x => {
    let ident = getDecoratorIdent(x);
    if (ident) {
      let name = ident.text;
      return name === Ignore.name || name === Field.name;
    } else {
      return false;
    }
  });

  if (!ignore && state.inSchema) {
    let typeExpr = resolveType(node.type!, state);
    let properties = [];
    if (!node.questionToken) {
      properties.push(ts.createPropertyAssignment('required', ts.createArrayLiteral([
        ts.createTrue(), ts.createLiteral(Messages.REQUIRED)
      ])));
    }

    // If we have a union type
    if (node.type!.kind === ts.SyntaxKind.UnionType && ['Number', 'String'].indexOf((typeExpr as any).text) > 0) {

      let types = (node.type! as ts.UnionTypeNode).types
      let literals = types.map(x => (x as ts.LiteralTypeNode).literal);
      let values = literals.map(x => x.getText());

      properties.push(ts.createPropertyAssignment('enum', ts.createObjectLiteral([
        ts.createPropertyAssignment('values', ts.createArrayLiteral(literals)),
        ts.createPropertyAssignment('message', ts.createLiteral(`{PATH} is only allowed to be "${values.join('" or "')}"`))
      ])));
    }

    let params = [typeExpr];
    if (properties.length) {
      params.push(ts.createObjectLiteral(properties));
    }

    let dec = ts.createDecorator(ts.createCall(state.inSchema, undefined, params));
    let res = ts.createProperty(
      (node.decorators! || []).concat([dec]),
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
    let res = computeClass(node);
    let ret = ts.visitEachChild(node, c => visitNode(context, c, { ...state, inSchema: res }), context);
    return ret;
  } else if (ts.isPropertyDeclaration(node) && !!state.inSchema) {
    return computeProperty(node, state) as any as T;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

