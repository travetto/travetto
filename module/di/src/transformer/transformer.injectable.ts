import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@encore/compiler';
import { ConfigLoader } from '@encore/config';

let INJECTABLES = (function () {
  let out: { [key: string]: Set<string> } = {
    Injectable: new Set([require.resolve('../decorator/injectable')])
  };

  let injs = ConfigLoader.bindTo({}, 'di.injectables') as any;

  for (let k of Object.keys(injs)) {
    let v = injs[k];
    if (!(v in out)) {
      out[v] = new Set();
    }
    k = k
      .replace(/@encore/, `${process.cwd()}/node_modules/@encore`)
      .replace('./', `${process.cwd()}/`);
    out[v].add(k);
  }
  return out;
})();

interface DiState extends State {
  inInjectable: boolean;
  decorators: { [key: string]: ts.Expression };
  import?: ts.Identifier
}

function processDeclaration(state: State, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
  let injection = TransformUtil.findAnyDecorator(param, { Inject: new Set([require.resolve('../decorator/injectable')]) });

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

function createInjectDecorator(state: DiState, name: string, contents?: ts.Expression) {
  if (!state.decorators[name]) {
    if (!state.import) {
      state.import = ts.createIdentifier(`import_Injectable`);
      state.imports.push({
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
    let foundDec = TransformUtil.findAnyDecorator(node, INJECTABLES);
    let decls = node.decorators;
    if (foundDec) {

      node = ts.visitEachChild(node, c => visitNode(context, c, state), context);

      let declTemp = (node.decorators || []).slice(0);
      let cons = (node as any as ts.ClassDeclaration).members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
      if (cons) {
        let expr = TransformUtil.fromLiteral(cons.parameters.map(x => processDeclaration(state, x)));
        declTemp.push(createInjectDecorator(state, 'InjectArgs', expr));
      } else {
        declTemp.push(createInjectDecorator(state, 'InjectArgs'));
      }

      // Add injectable to if not there
      let injectable = TransformUtil.findAnyDecorator(node, { Injectable: new Set([require.resolve('../decorator/injectable')]) });
      if (!injectable) {
        injectable = createInjectDecorator(state, 'Injectable');
        declTemp.push(injectable);
      }

      // Force injectable to top
      if (declTemp[0] !== injectable) {
        declTemp.unshift(...declTemp.splice(declTemp.indexOf(injectable), 1))
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