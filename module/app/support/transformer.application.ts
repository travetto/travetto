import * as ts from 'typescript';

import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

class ApplicationTransformer {

  // TODO: Rework
  static readType(node: ts.TypeNode) {
    const kind = node!.kind;
    let type: string;

    switch (kind) {
      case ts.SyntaxKind.BooleanKeyword:
      case ts.SyntaxKind.TrueKeyword:
      case ts.SyntaxKind.FalseKeyword:
        type = 'boolean';
        break;
      case ts.SyntaxKind.NumberKeyword:
      case ts.SyntaxKind.NumericLiteral:
        type = 'number';
        break;
      case ts.SyntaxKind.StringKeyword:
      case ts.SyntaxKind.StringLiteral:
      default:
        type = 'string';
        break;
    }
    return type;
  }

  static computeParam(p: ts.ParameterDeclaration) {
    const name = p.name.getText();
    const hasDefault = !!p.initializer || !!p.questionToken;
    const def = p.initializer ? TransformUtil.toLiteral(p.initializer) : undefined;
    const typeNode = p.type || p.initializer;

    let type;
    let subtype;
    let meta;

    if (typeNode) {
      if (p.type && ts.isUnionTypeNode(p.type)) {
        const literals = p.type.types.map(x => (x as ts.LiteralTypeNode).literal);
        type = ApplicationTransformer.readType(p.type.types[0]);
        subtype = 'choice';
        meta = {
          choices: literals.map(x => {
            const val = x.getText();
            return ts.isStringLiteral(x) ? val.substring(1, val.length - 1) : val;
          })
        };
      } else {
        type = ApplicationTransformer.readType(typeNode as ts.TypeNode);
        if (type === 'string' && /file$/i.test(name)) {
          subtype = 'file';
        }
      }
    } else {
      type = 'string';
    }

    return { name, type, subtype, meta, optional: hasDefault, def };
  }

  static handleClass(state: TransformerState, node: ts.ClassDeclaration, dec: ts.Decorator) {
    if (dec && ts.isCallExpression(dec.expression)) { // Constructor

      const runMethod = node.members
        .filter(x => ts.isMethodDeclaration(x))
        .filter(x => x.name!.getText() === 'run')[0];

      if (runMethod && ts.isMethodDeclaration(runMethod)) {
        const outParams = runMethod.parameters.map(p => ApplicationTransformer.computeParam(p));

        const declArgs = [...dec.expression.arguments];

        if (dec.expression.arguments.length === 1) {
          declArgs.push(TransformUtil.fromLiteral({}));
        }

        dec.expression.arguments = ts.createNodeArray([
          ...declArgs,
          TransformUtil.fromLiteral(outParams)
        ]);

        const decls = node.decorators;
        return ts.updateClassDeclaration(node,
          decls,
          node.modifiers,
          node.name,
          node.typeParameters,
          ts.createNodeArray(node.heritageClauses),
          node.members
        );
      }
    }
    return node;
  }
}

export const transformers: NodeTransformer[] = [
  { type: 'class', aliasName: 'application', before: ApplicationTransformer.handleClass }
];