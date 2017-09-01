import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@encore/base';

interface DiState extends State {
  inInjectable: boolean;
  decorators: { [key: string]: ts.Expression };
}

export const Transformer = TransformUtil.importingVisitor<DiState>(() => ({
  inInjectable: false,
  decorators: {}
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

function createInjectDecorator(state: DiState, name: string, contents: ts.Expression) {
  if (!state.decorators[name]) {
    let ident = ts.createIdentifier(name);
    let importName = ts.createUniqueName(`import_${ident.text}`);
    state.imports.push({
      ident: importName,
      path: require.resolve('../decorator/injectable')
    });
    state.decorators[name] = ts.createPropertyAccess(importName, ident);
  }
  return ts.createDecorator(
    ts.createCall(
      state.decorators[name],
      undefined,
      ts.createNodeArray([contents])
    )
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: DiState): T {
  if (ts.isClassDeclaration(node)) {
    let foundDec = TransformUtil.getDecorator(node, require.resolve('../decorator/injectable'), 'Injectable');
    let decl: ts.Decorator[] = [];

    if (foundDec) {
      node = ts.visitEachChild(node, c => visitNode(context, c, state), context);
      let cons = (node as any as ts.ClassDeclaration).members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;

      if (cons) {
        let expr = TransformUtil.fromLiteral(cons.parameters.map(x => processDeclaration(state, x)));
        decl = [createInjectDecorator(state, 'InjectArgs', (expr as any).elements)];
        decl[0].parent = node;
      }
    }

    let cNode = node as any as ts.ClassDeclaration;
    return ts.updateClassDeclaration(cNode,
      ts.createNodeArray([...decl, ...(cNode.decorators || [])]),
      cNode.modifiers,
      cNode.name,
      cNode.typeParameters,
      ts.createNodeArray(cNode.heritageClauses),
      ts.createNodeArray([
        getIdent(),
        ...cNode.members
      ])) as any;
  } if (ts.isPropertyDeclaration(node)) {
    let expr = processDeclaration(state, node);

    if (expr) {
      let final = createInjectDecorator(state, 'Inject', expr);
      let finalDecs = ((node.decorators as any as ts.Decorator[]) || [])
        .filter(x => TransformUtil.getDecoratorIdent(x).text !== 'Inject');

      // Doing decls
      let ret = ts.updateProperty(node,
        ts.createNodeArray([final, ...finalDecs]),
        node.modifiers,
        node.name,
        node.questionToken,
        node.type,
        node.initializer
      ) as any;
      ret.parent = node.parent;
      return ret;
    } else {
      return node;
    }
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}
