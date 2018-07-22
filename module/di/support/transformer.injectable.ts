import * as ts from 'typescript';
import { TransformUtil, TransformerState } from '@travetto/compiler';
import { ConfigLoader } from '@travetto/config';

const INJECTABLE_MOD = require.resolve('../src/decorator/injectable');

const INJECTABLES = TransformUtil.buildImportAliasMap({
  ...ConfigLoader.get('registry.injectable'),
  '@travetto/di': ['Injectable']
});

interface DiState extends TransformerState {
  inInjectable: boolean;
}

function processDeclaration(state: TransformerState, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
  const injection = TransformUtil.findAnyDecorator(state, param, { Inject: new Set(['@travetto/di']) });

  if (injection || ts.isParameter(param)) {
    const finalTarget = TransformUtil.importTypeIfExternal(state, param.type!);

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

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: DiState): T {
  if (ts.isClassDeclaration(node)) { // Class declaration
    const foundDec = TransformUtil.findAnyDecorator(state, node, INJECTABLES);

    if (foundDec) { // Constructor
      let decls = node.decorators;

      node = ts.visitEachChild(node, c => visitNode(context, c, state), context);

      const clsNode = (node as any as ts.ClassDeclaration);
      const declTemp = (node.decorators || []).slice(0);
      const cons = clsNode.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
      let injectArgs = undefined;

      if (cons) {
        try {
          injectArgs = TransformUtil.fromLiteral(cons.parameters.map(x => processDeclaration(state, x)));
        } catch (e) {
          // If error, skip
          if (e.message !== 'Type information not found') {
            throw e;
          } else {
            console.error(`Cannot get @InjectArgs for ${clsNode.name!.text}`);
          }
        }
      }

      declTemp.push(TransformUtil.createDecorator(state, INJECTABLE_MOD, 'InjectArgs', injectArgs));

      // Add injectable decorator if not there (for aliased decorators)
      let injectable = TransformUtil.findAnyDecorator(state, node, { Injectable: new Set(['@travetto/di']) });
      if (!injectable) {
        injectable = TransformUtil.createDecorator(state, INJECTABLE_MOD, 'Injectable');
        declTemp.push(injectable);
      } else {
        const callExpr = (injectable && injectable.expression as any as ts.CallExpression);
        let injectConfig = undefined;

        if (callExpr) {
          const args = callExpr.arguments! || [];
          injectConfig = args[0] as any;
          // Handle special case
          if (args[0] && ts.isIdentifier(args[0])) {
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

      ret.parent = node.parent;

      for (const el of ret.members) {
        if (!el.parent) {
          el.parent = node;
        }
      }

      return ret;
    }
  } else if (ts.isPropertyDeclaration(node)) { // Property
    const expr = processDeclaration(state, node);

    if (expr) {
      const final = TransformUtil.createDecorator(state, INJECTABLE_MOD, 'Inject', expr);
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
    const foundDec = TransformUtil.findAnyDecorator(state, node, { InjectableFactory: new Set(['@travetto/di']) });
    const decls = node.decorators;

    if (foundDec) { // Constructor
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
        target = TransformUtil.importTypeIfExternal(state, node.type!);
      }
      const args = TransformUtil.extendObjectLiteral({
        dependencies: injectArgs,
        src: (node.parent as ts.ClassDeclaration).name,
        class: target,
        original
      }, injectConfig);

      const ret = ts.createMethod(
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
  }), visitNode),
  priority: 11,
  phase: 'before'
};