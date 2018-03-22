import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@travetto/compiler';
import { ConfigLoader } from '@travetto/config';

let INJECTABLES = TransformUtil.buildImportAliasMap({
  ...ConfigLoader.get('registry.injectable'),
  '@travetto/di': 'Injectable'
});

interface DiState extends State {
  inInjectable: boolean;
  decorators: { [key: string]: ts.Expression };
  import?: ts.Identifier
}

function processDeclaration(state: State, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
  const injection = TransformUtil.findAnyDecorator(param, { Inject: new Set(['@travetto/di']) }, state);

  if (injection || ts.isParameter(param)) {
    const finalTarget = TransformUtil.importIfExternal(param.type!, state);
    const injectConfig = TransformUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(injection);

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

function createInjectDecorator(state: DiState, name: string, contents?: ts.Expression) {
  if (!state.decorators[name]) {
    if (!state.import) {
      state.import = ts.createIdentifier(`import_Injectable`);
      state.newImports.push({
        ident: state.import,
        path: require.resolve('../decorator/injectable')
      });
    }
    const ident = ts.createIdentifier(name);
    state.decorators[name] = ts.createPropertyAccess(state.import, ident);
  }
  return ts.createDecorator(
    ts.createCall(
      state.decorators[name],
      undefined,
      contents ? [contents] : []
    )
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: DiState): T {
  if (ts.isClassDeclaration(node)) {
    const foundDec = TransformUtil.findAnyDecorator(node, INJECTABLES, state);
    let decls = node.decorators;

    if (foundDec) {

      node = ts.visitEachChild(node, c => visitNode(context, c, state), context);

      const declTemp = (node.decorators || []).slice(0);
      const cons = (node as any as ts.ClassDeclaration).members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
      let injectArgs = undefined;

      if (cons) {
        try {
          injectArgs = TransformUtil.fromLiteral(cons.parameters.map(x => processDeclaration(state, x)));
        } catch (e) {
          // If error, skip
          if (e.message !== 'Type information not found') {
            throw e;
          }
        }
      }

      declTemp.push(createInjectDecorator(state, 'InjectArgs', injectArgs));

      // Add injectable to if not there
      let injectable = TransformUtil.findAnyDecorator(node, { Injectable: new Set(['@travetto/di']) }, state);
      if (!injectable) {
        injectable = createInjectDecorator(state, 'Injectable');
        declTemp.push(injectable);
      }

      decls = ts.createNodeArray(declTemp);
    }

    const cNode = node as any as ts.ClassDeclaration;
    const out = ts.updateClassDeclaration(cNode,
      decls,
      cNode.modifiers,
      cNode.name,
      cNode.typeParameters,
      ts.createNodeArray(cNode.heritageClauses),
      cNode.members
    ) as any;

    return out;
  } if (ts.isPropertyDeclaration(node)) {
    const expr = processDeclaration(state, node);

    if (expr) {
      const final = createInjectDecorator(state, 'Inject', expr);
      const finalDecs = ((node.decorators as any as ts.Decorator[]) || [])
        .filter(x => TransformUtil.getDecoratorIdent(x).text !== 'Inject');

      // Doing decls
      const ret = ts.updateProperty(
        node,
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


export const InjectableTransformer = {
  transformer: TransformUtil.importingVisitor<DiState>(() => ({
    inInjectable: false,
    decorators: {}
  }), visitNode),
  phase: 'before'
}