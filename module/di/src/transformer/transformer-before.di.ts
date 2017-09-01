import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@encore/base';

export const Transformer = TransformUtil.importingVisitor(() => ({}), visitNode);

function processDeclaration(state: State, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
  let injection = TransformUtil.getDecorator(param, require.resolve('../decorator/injectable'), 'Inject');

  if (injection || ts.isParameter(param)) {
    let finalTarget = TransformUtil.importIfExternal(param, state);
    let injectConfig = TransformUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(injection);

    return TransformUtil.fromLiteral({
      target: finalTarget,
      optional: TransformUtil.getObjectValue(injectConfig, 'optional'),
      name: TransformUtil.getObjectValue(injectConfig, 'name')
    });
  }
}

function getIdent() {
  return ts.createProperty(
    undefined,
    [ts.createToken(ts.SyntaxKind.StaticKeyword)],
    '__filename', undefined, undefined,
    ts.createIdentifier('__filename')
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: State): T {
  if (ts.isClassDeclaration(node)) {
    let foundDec = TransformUtil.getDecorator(node, require.resolve('../decorator/injectable'), 'Injectable');

    if (!foundDec) {
      return ts.updateClassDeclaration(node,
        node.decorators,
        node.modifiers,
        node.name,
        node.typeParameters,
        ts.createNodeArray(node.heritageClauses),
        ts.createNodeArray([
          getIdent(),
          ...node.members
        ])) as any;
    }

    let cons;
    for (let member of node.members) {
      if (ts.isConstructorDeclaration(member)) {
        cons = member;
        break;
      }
    }

    let fields = node.members
      .filter(x => ts.isPropertyDeclaration(x))
      .filter(x => !!TransformUtil.getDecorator(x, require.resolve('../decorator/injectable'), 'Inject'));

    let ret = ts.visitEachChild(node, c => visitNode(context, c, state), context);
    let decs: ts.NodeArray<ts.Decorator> = ret.decorators!;

    if (cons || fields.length) {
      let dec = foundDec!;
      let decConfig = (dec.expression as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
      let deps: any = {};
      if (cons) {
        deps.cons = (cons.parameters! || [])
          .map(x => processDeclaration(state, x));
      }
      if (fields) {
        deps.fields = fields
          .map(x => [x.name!.getText(), processDeclaration(state, x as ts.PropertyDeclaration)] as [string, ts.Node])
          .filter(x => !!x)
          .reduce((acc, [name, decNode]) => {
            acc[name] = decNode;
            return acc;
          }, {} as any);
      }
      let conf = TransformUtil.extendObjectLiteral({
        annotations: (node.decorators! || []).slice(0).map(x => TransformUtil.getDecoratorIdent(x)).filter(x => !!x),
        dependencies: deps
      }, decConfig);

      dec = ts.updateDecorator(dec, ts.updateCall(
        (dec.expression as ts.CallExpression),
        (dec.expression as ts.CallExpression).expression,
        undefined,
        [conf]
      ));

      decs = ts.createNodeArray([dec, ...(ret.decorators! || []).slice(0).filter(x => x !== foundDec)]);
    }

    ret = ts.updateClassDeclaration(ret,
      decs,
      ret.modifiers, ret.name,
      ret.typeParameters,
      ts.createNodeArray(ret.heritageClauses),
      ts.createNodeArray([
        getIdent(),
        ...ret.members
      ])) as any;

    return ret;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}
