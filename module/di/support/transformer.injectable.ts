import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, DecoratorMeta, OnClass, OnProperty, OnStaticMethod, res
} from '@travetto/compiler/src/transform-support';

const INJECTABLE_MOD = require.resolve('../src/decorator');

export class InjectableTransformer {

  static processDeclaration(state: TransformerState, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
    const injection = state.findDecorator(param, 'trv/di/Inject', 'Inject', INJECTABLE_MOD);

    if (injection || ts.isParameter(param)) {

      const finalTarget = state.getOrImport(param);

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

  @OnClass('trv/di/Injectable')
  static handleClass(state: TransformerState, node: ts.ClassDeclaration) {
    const clsNode = (node as any as ts.ClassDeclaration);
    const declTemp = (node.decorators || []).slice(0);
    const cons = clsNode.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
    let injectArgs = undefined;

    if (cons) {
      injectArgs = TransformUtil.fromLiteral(cons.parameters.map(x => InjectableTransformer.processDeclaration(state, x)));
    }

    state.importDecorator(INJECTABLE_MOD, 'InjectArgs');
    declTemp.push(state.createDecorator('InjectArgs', injectArgs));

    // Add injectable decorator if not there
    let injectable = state.getDecoratorList(node)
      // TODO: might need more strict comparison
      .find(x => x.targets?.includes('trv/di/Injectable') && x.name === 'Injectable')?.dec;

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

  @OnProperty('trv/di/Inject')
  static handleProperty(state: TransformerState, node: ts.PropertyDeclaration, dm?: DecoratorMeta) {
    const expr = InjectableTransformer.processDeclaration(state, node)!;

    // Replace
    state.importDecorator(INJECTABLE_MOD, 'Inject');
    const final = state.createDecorator('Inject', expr);
    const injected = state.getDecoratorList(node)
      .filter(x => x.targets?.includes('Inject'))?.[0]?.dec;

    const finalDecs = ((node.decorators as any as ts.Decorator[]) || [])
      .filter(x => x !== injected);

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

  @OnStaticMethod('trv/di/InjectableFactory')
  static handleFactory(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {
    let original: any;
    const injectArgs = node.parameters.map(x => InjectableTransformer.processDeclaration(state, x)!);

    const dec = dm?.dec;

    if (!dec) {
      return node;
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
    let target: any = TransformUtil.getObjectValue(injectConfig, 'target');
    if (target === undefined) {  // TODO: infer from typings, not just text?
      const ret = state.resolveReturnType(node);
      console.debug('Resolving type', node.getText(), ret);
      if (res.isExternalType(ret)) {
        target = state.getOrImport(ret);
      }
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