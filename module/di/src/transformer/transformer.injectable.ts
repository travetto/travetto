import * as ts from 'typescript';
import { TransformUtil, Import, State } from '@travetto/compiler';
import { ConfigLoader } from '@travetto/config';

const INJECTABLES = TransformUtil.buildImportAliasMap({
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

    let injectConfig = TransformUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(injection);

    let original = undefined;

    const callExpr = (injection && injection.expression as any as ts.CallExpression);
    if (callExpr) {
      const args = callExpr.arguments! || [];

      // Handle special case
      if (args.length && ts.isIdentifier(args[0])) {
        original = args[0];
        injectConfig = args[1] as any;
      }
    }

    if (injectConfig === undefined) {
      injectConfig = TransformUtil.fromLiteral({});
    }

    let optional = TransformUtil.getObjectValue(injectConfig, 'optional');

    if (optional === undefined && !!param.questionToken) {
      optional = ts.createTrue();
    }

    return TransformUtil.fromLiteral({
      original,
      target: finalTarget,
      optional,
      qualifier: TransformUtil.getObjectValue(injectConfig, 'qualifier')
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
  if (ts.isClassDeclaration(node)) { // Class declaration
    const foundDec = TransformUtil.findAnyDecorator(node, INJECTABLES, state);

    if (foundDec) { // Constructor
      let decls = node.decorators;

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

      // Add injectable decorator if not there (for aliased decorators)
      let injectable = TransformUtil.findAnyDecorator(node, { Injectable: new Set(['@travetto/di']) }, state);
      if (!injectable) {
        injectable = createInjectDecorator(state, 'Injectable');
        declTemp.push(injectable);
      } else {
        let original = undefined;
        const callExpr = (injectable && injectable.expression as any as ts.CallExpression);
        let injectConfig = undefined;

        if (callExpr) {
          const args = callExpr.arguments! || [];
          injectConfig = args[0] as any;
          // Handle special case
          if (args[0] && ts.isIdentifier(args[0])) {
            original = args[0];
            injectConfig = args[1] as any;
          }
          if (injectConfig === undefined) {
            injectConfig = TransformUtil.fromLiteral({});
          }
          ts.updateCall(callExpr, callExpr.expression, callExpr.typeArguments, ts.createNodeArray([injectConfig]));
        }
      }

      decls = ts.createNodeArray(declTemp);
      const cNode = node as any as ts.ClassDeclaration;
      const ret = ts.updateClassDeclaration(cNode,
        decls,
        cNode.modifiers,
        cNode.name,
        cNode.typeParameters,
        ts.createNodeArray(cNode.heritageClauses),
        cNode.members
      ) as any;

      return ret;
    }
  } else if (ts.isPropertyDeclaration(node)) { // Property
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
  } else if (ts.isMethodDeclaration(node) && (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) > 0) { // tslint:disable-line no-bitwise
    // Factory for static methods
    const foundDec = TransformUtil.findAnyDecorator(node, { InjectableFactory: new Set(['@travetto/di']) }, state);
    const decls = node.decorators;

    if (foundDec) { // Constructor
      const declTemp = (node.decorators || []).slice(0);

      let injectArgs: object[] = [];
      let original: any;

      try {
        injectArgs = node.parameters.map(x => processDeclaration(state, x)!);
      } catch (e) {
        // If error, skip
        if (e.message !== 'Type information not found') {
          throw e;
        }
      }

      let injectConfig = TransformUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(foundDec);

      const callExpr = (foundDec && foundDec.expression as any as ts.CallExpression);
      if (callExpr) {
        const callArgs = callExpr.arguments! || [];
        // Handle special case
        if (callArgs[0] && ts.isIdentifier(callArgs[0])) {
          original = callArgs[0];
          injectConfig = callArgs[1] as any;
        }
      }

      if (injectConfig === undefined) {
        injectConfig = TransformUtil.fromLiteral({});
      }

      // Handle when
      let target = TransformUtil.getObjectValue(injectConfig, 'target');
      if (node.type && target === undefined) {  // TODO: infer from typings, not just text?
        target = TransformUtil.importIfExternal(node.type!, state);
      }
      const args = TransformUtil.extendObjectLiteral({
        dependencies: injectArgs,
        class: target,
        original
      }, injectConfig);

      node = ts.createMethod(
        decls!.filter(x => x !== foundDec).concat([
          ts.createDecorator(
            ts.createCall(
              callExpr.expression,
              callExpr.typeArguments,
              ts.createNodeArray([args])
            )
          )
        ]),
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        node.parameters,
        node.type,
        node.body
      ) as any;

      return node;
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
  priority: 11,
  phase: 'before'
}