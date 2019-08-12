import * as ts from 'typescript';

import { TransformUtil, TransformerState, NodeTransformer } from '@travetto/compiler';

const INJECT_MATCHER = TransformUtil.decoratorMatcher('inject');
const INJECTABLE_MATCHER = TransformUtil.decoratorMatcher('injectable');

const INJECTABLE_MOD = require.resolve('../src/decorator');

class InjectableTransformer {

  static processDeclaration(state: TransformerState, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
    const matched = INJECT_MATCHER(param, state.imports);
    const injection = matched.get('Inject');

    if (injection || ts.isParameter(param)) {
      const finalTarget = state.importTypeIfExternal(param.type!);

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

  static handleClass(state: TransformerState, node: ts.ClassDeclaration, dec: ts.Decorator) {
    const clsNode = (node as any as ts.ClassDeclaration);
    const declTemp = (node.decorators || []).slice(0);
    const cons = clsNode.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
    let injectArgs = undefined;

    if (cons) {
      try {
        injectArgs = TransformUtil.fromLiteral(cons.parameters.map(x => InjectableTransformer.processDeclaration(state, x)));
      } catch (e) {
        // If error, skip
        if (e.message !== 'Type information not found') {
          throw e;
        } else {
          console.error(`Cannot get @InjectArgs for ${clsNode.name!.text}`);
        }
      }
    }

    state.importDecorator(INJECTABLE_MOD, 'InjectArgs');
    declTemp.push(state.createDecorator('InjectArgs', injectArgs));

    // Add injectable decorator if not there
    const decs = INJECTABLE_MATCHER(node, state.imports);
    let injectable = decs.get('Injectable');

    if (!injectable) { // If missing, add
      state.importDecorator(INJECTABLE_MOD, 'Injectable');
      injectable = state.createDecorator('Injectable');
      declTemp.push(injectable);
    } else { // Otherwise extend
      const callExpr = injectable.expression as any as ts.CallExpression;
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

    return ts.updateClassDeclaration(node,
      ts.createNodeArray(declTemp),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      node.members
    );
  }

  static handleProperty(state: TransformerState, node: ts.PropertyDeclaration, dec: ts.Decorator) {
    const expr = InjectableTransformer.processDeclaration(state, node)!;

    // Replace
    state.importDecorator(INJECTABLE_MOD, 'Inject');
    const final = state.createDecorator('Inject', expr);
    const finalDecs = ((node.decorators as any as ts.Decorator[]) || [])
      .filter(x => TransformUtil.getDecoratorIdent(x).text !== 'Inject');

    // Doing decls
    return ts.updateProperty(
      node,
      ts.createNodeArray([final, ...finalDecs]),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
  }

  static handleFactory(state: TransformerState, node: ts.MethodDeclaration, dec: ts.Decorator) {
    let injectArgs: object[] = [];
    let original: any;

    try {
      injectArgs = node.parameters.map(x => InjectableTransformer.processDeclaration(state, x)!);
    } catch (e) {
      // If error, skip
      if (e.message !== 'Type information not found') {
        throw e;
      }
    }

    let injectConfig = TransformUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(dec);

    const callExpr = (dec.expression as any as ts.CallExpression);

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
      target = state.importTypeIfExternal(node.type!);
    }

    const args = TransformUtil.extendObjectLiteral({
      dependencies: injectArgs,
      src: (node.parent as ts.ClassDeclaration).name,
      target,
      original
    }, injectConfig);

    // Replace decorator
    const decls = node.decorators;
    return ts.createMethod(
      decls!.filter(x => x !== dec).concat([
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
    );
  }
}

export const transformers: NodeTransformer[] = [
  { type: 'class', aliasName: 'injectable', after: InjectableTransformer.handleClass },
  { type: 'property', aliasName: 'inject', before: InjectableTransformer.handleProperty },
  { type: 'static-method', aliasName: 'injectable-factory', before: InjectableTransformer.handleFactory }
];