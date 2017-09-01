import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@encore/base';

interface DiState extends State {
  inInjectable: boolean;
  addInject: ts.Expression | undefined;
}

export const Transformer = TransformUtil.importingVisitor<DiState>(() => ({
  inInjectable: false
}), visitNode);

function processDeclaration(state: State, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
  let injection = TransformUtil.getDecorator(param, require.resolve('../decorator/injectable'), 'Inject');

  if (injection || ts.isParameter(param)) {
    let finalTarget = TransformUtil.importIfExternal(param, state);
    let injectConfig = TransformUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(injection);

    let optional = TransformUtil.getObjectValue(injectConfig, 'optional');

    if (optional === undefined && !!param.questionToken) {
      optional = ts.createFalse();
    }

    return TransformUtil.fromLiteral({
      target: finalTarget,
      optional,
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

function createInjectDecorator(state: DiState, contents: ts.Expression) {
  if (!state.addInject) {
    let ident = ts.createIdentifier('Inject');
    let importName = ts.createUniqueName(`import_${ident.text}`);
    state.imports.push({
      ident: importName,
      path: require.resolve('../decorator/injectable')
    });
    state.addInject = ts.createPropertyAccess(importName, ident);
  }
  return ts.createDecorator(
    ts.createCall(
      state.addInject,
      undefined,
      [contents]
    )
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: DiState): T {
  if (ts.isClassDeclaration(node)) {
    let foundDec = TransformUtil.getDecorator(node, require.resolve('../decorator/injectable'), 'Injectable');

    if (foundDec) {
      node = ts.visitEachChild(node, c => visitNode(context, c, state), context);
    }
    let cNode = node as any as ts.ClassDeclaration;
    return ts.updateClassDeclaration(cNode,
      cNode.decorators,
      cNode.modifiers,
      cNode.name,
      cNode.typeParameters,
      ts.createNodeArray(cNode.heritageClauses),
      ts.createNodeArray([
        getIdent(),
        ...cNode.members
      ])) as any;
  } else if (ts.isConstructorDeclaration(node)) {
    let decl = createInjectDecorator(state,
      TransformUtil.fromLiteral(node.parameters.map(x => processDeclaration(state, x))))

    return ts.updateConstructor(node,
      ts.createNodeArray([decl, ...(node.decorators || [])]),
      node.modifiers,
      node.parameters,
      node.body
    ) as any;
  } else if (ts.isPropertyDeclaration(node)) {
    let expr = processDeclaration(state, node);

    if (expr) {
      let final = createInjectDecorator(state, expr);
      // Doing decls
      return ts.updateProperty(node,
        ts.createNodeArray([final, ...((node.decorators as any as ts.Decorator[]) || [])
          .filter(x => TransformUtil.getDecoratorIdent(x).text !== 'Inject')]),
        node.modifiers,
        node.name,
        node.questionToken,
        node.type,
        node.initializer
      ) as any;
    } else {
      return node;
    }
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}
