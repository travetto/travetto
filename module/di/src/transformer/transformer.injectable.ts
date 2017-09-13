import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@encore2/compiler';
import { ConfigLoader } from '@encore2/config';

let INJECTABLES = TransformUtil.buildImportAliasMap({
  ...ConfigLoader.get('registry.injectable'),
  [require.resolve('../decorator/injectable')]: 'Injectable'
});

interface DiState extends State {
  inInjectable: boolean;
  decorators: { [key: string]: ts.Expression };
  import?: ts.Identifier
}

function processDeclaration(state: State, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
  let injection = TransformUtil.findAnyDecorator(param, { Inject: new Set([require.resolve('../decorator/injectable')]) }, state);

  if (injection || ts.isParameter(param)) {
    let finalTarget = TransformUtil.importIfExternal(param.type!.getText(), state);
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

function createInjectDecorator(state: DiState, name: string, contents?: ts.Expression) {
  if (!state.decorators[name]) {
    if (!state.import) {
      state.import = ts.createIdentifier(`import_Injectable`);
      state.newImports.push({
        ident: state.import,
        path: require.resolve('../decorator/injectable')
      });
    }
    let ident = ts.createIdentifier(name);
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
    let foundDec = TransformUtil.findAnyDecorator(node, INJECTABLES, state);
    let decls = node.decorators;

    if (foundDec) {

      node = ts.visitEachChild(node, c => visitNode(context, c, state), context);

      let declTemp = (node.decorators || []).slice(0);
      let cons = (node as any as ts.ClassDeclaration).members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
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
      let injectable = TransformUtil.findAnyDecorator(node, { Injectable: new Set([require.resolve('../decorator/injectable')]) }, state);
      if (!injectable) {
        injectable = createInjectDecorator(state, 'Injectable');
        declTemp.push(injectable);
      }

      decls = ts.createNodeArray(declTemp);
    }

    let cNode = node as any as ts.ClassDeclaration;
    let out = ts.updateClassDeclaration(cNode,
      decls,
      cNode.modifiers,
      cNode.name,
      cNode.typeParameters,
      ts.createNodeArray(cNode.heritageClauses),
      cNode.members
    ) as any;

    return out;
  } if (ts.isPropertyDeclaration(node)) {
    let expr = processDeclaration(state, node);

    if (expr) {
      let final = createInjectDecorator(state, 'Inject', expr);
      let finalDecs = ((node.decorators as any as ts.Decorator[]) || [])
        .filter(x => TransformUtil.getDecoratorIdent(x).text !== 'Inject');

      // Doing decls
      let ret = ts.updateProperty(
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