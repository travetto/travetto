import * as ts from 'typescript';
import { AutoSchema, Ignore } from './auto';
import { Field } from './field';

type DecList = ts.NodeArray<ts.Decorator>;
type SchemaList = (ts.Expression | null)[];

interface State {
  inSchema: SchemaList;
  declared: ts.Identifier[]
}

export const Transformer =
  (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => {
      let state: State = { inSchema: [], declared: [] };
      let res = visitNode(context, file, state);
      return res;
    };

function computeClass(node: ts.ClassDeclaration) {
  let decs = (node.decorators || [] as any as DecList).filter(d => !!d.expression);
  if (decs && decs.length) {
    let auto = decs.find(d => d.expression.getText().startsWith(AutoSchema.name));
    if (auto) {
      if (ts.isCallExpression(auto.expression)) {
        return auto.expression.expression;
      } else if (ts.isIdentifier(auto.expression)) {
        return auto.expression;
      }
    }
  }
  return null;
}

function resolveType(type: ts.TypeNode | ts.TypeElement, state: State) {
  let expr: ts.Expression;
  let kind = type && type!.kind;
  switch (kind) {
    case ts.SyntaxKind.TypeReference:
      expr = ((type as ts.TypeReferenceNode).typeName) as ts.Expression;
      state.declared.push(expr as ts.Identifier);
      break;
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
    case ts.SyntaxKind.ObjectKeyword:
    default:
      expr = ts.createIdentifier('Object');
      break;
  }
  return expr;
}

function computeProperty(node: ts.PropertyDeclaration, state: State) {
  let ignore = (node.decorators || [] as any as DecList).find(x => {
    let ident: ts.Identifier | undefined;
    if (ts.isCallExpression(x.expression)) {
      ident = x.expression.expression as ts.Identifier;
    } else if (ts.isIdentifier(x.expression)) {
      ident = x.expression;
    }
    if (ident) {
      let name = ident.text;
      return name === Ignore.name || name === Field.name;
    } else {
      return false;
    }
  });

  if (!ignore) {
    node.decorators = node.decorators || [] as any;
    let expr = resolveType(node.type!, state);
    let dec = ts.createDecorator(ts.createCall(state.inSchema[0] as ts.Expression, undefined, [expr]));
    node.decorators!.unshift(dec);
  }
}

function visitNode(context: ts.TransformationContext, node: ts.Node, state: State): ts.Node {
  if (ts.isClassDeclaration(node)) {
    let res = computeClass(node);
    state.inSchema.unshift(res);
    ts.visitEachChild(node, c => visitNode(context, c, state), context);
    state.inSchema.shift();
  } else {
    if (ts.isPropertyDeclaration(node) && state.inSchema[0]) {
      computeProperty(node, state);
    }
    ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
  return node;
}

