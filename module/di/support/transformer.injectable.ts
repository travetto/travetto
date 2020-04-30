import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, DecoratorMeta, OnClass, OnProperty, OnStaticMethod, res
} from '@travetto/compiler/src/transform-support';

const INJECTABLE_MOD = require.resolve('../src/decorator');

// TODO: Document
export class InjectableTransformer {

  static processDeclaration(state: TransformerState, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
    const existing = state.findDecorator(param, 'trv/di/Inject', 'Inject', INJECTABLE_MOD);

    if (!(existing || ts.isParameter(param))) {
      return;
    }

    let injectConfig = existing ? TransformUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(existing) : undefined;

    let original = undefined;

    const callExpr = existing?.expression as ts.CallExpression;
    if (callExpr) {
      const args = callExpr.arguments! ?? [];
      // Handle special case
      if (args.length && ts.isIdentifier(args[0])) {
        original = args[0];
        injectConfig = args[1] as any;
      }
    }

    injectConfig = injectConfig ?? TransformUtil.fromLiteral({});

    let optional = TransformUtil.getObjectValue(injectConfig, 'optional');
    if (optional === undefined && !!param.questionToken) {
      optional = ts.createTrue();
    }

    return TransformUtil.fromLiteral({
      original,
      target: state.getOrImport(param),
      optional,
      qualifier: TransformUtil.getObjectValue(injectConfig, 'qualifier')
    });
  }

  @OnClass('trv/di/Injectable')
  static handleClass(state: TransformerState, node: ts.ClassDeclaration) {
    const cons = node.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
    const injectArgs = cons &&
      TransformUtil.fromLiteral(cons.parameters.map(x => InjectableTransformer.processDeclaration(state, x)));

    // Add injectable decorator if not there
    const decl = state.findDecorator(node, 'trv/di/Injectable', 'Injectable', INJECTABLE_MOD);

    // Find config
    let config: ts.ObjectLiteralExpression | undefined = undefined;
    if (decl && ts.isCallExpression(decl.expression)) { // Combine
      const callExpr = decl.expression;
      const args = callExpr.arguments;
      if (args.length) {
        const first = args[0];
        if (ts.isObjectLiteralExpression(first)) {
          config = first;
        } else {
          config = TransformUtil.fromLiteral({ qualifier: first });
        }
      }
    }

    return ts.updateClassDeclaration(node,
      TransformUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Injectable', config),
        state.createDecorator(INJECTABLE_MOD, 'InjectArgs', injectArgs)
      ]),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      node.members
    );
  }

  @OnProperty('trv/di/Inject')
  static handleProperty(state: TransformerState, node: ts.PropertyDeclaration, dm?: DecoratorMeta) {
    const decl = state.findDecorator(node, 'trv/di/Inject', 'Inject', INJECTABLE_MOD);

    // Doing decls
    return ts.updateProperty(
      node,
      TransformUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Inject', this.processDeclaration(state, node)!),
      ], 0),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
  }

  @OnStaticMethod('trv/di/InjectableFactory')
  static handleFactory(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {
    if (!dm?.dec) {
      return node;
    }

    const dec = dm?.dec;
    let original: any;

    // Extract config
    const injectArgs = node.parameters.map(x => InjectableTransformer.processDeclaration(state, x)!);
    let injectConfig = TransformUtil.getPrimaryArgument<ts.Node>(dec);

    if (injectConfig && ts.isIdentifier(injectConfig)) {
      original = injectConfig; // Shift to original
      injectConfig = undefined; // Config is empty
    }

    injectConfig = injectConfig ?? TransformUtil.fromLiteral({});

    if (!ts.isObjectLiteralExpression(injectConfig)) {
      throw new Error('Unexpected InjectFactory config parameter');
    }

    // Read target from config or resolve
    let target = TransformUtil.getObjectValue(injectConfig, 'target');
    if (!target) {  // Infer from typings
      const ret = state.resolveReturnType(node);
      if (res.isExternalType(ret)) {
        target = state.getOrImport(ret);
      }
    }

    // Build decl
    const args = TransformUtil.extendObjectLiteral({
      dependencies: injectArgs,
      src: (node.parent as ts.ClassDeclaration).name,
      target,
      original
    }, injectConfig);

    // Replace decorator
    return ts.createMethod(
      TransformUtil.spliceDecorators(node, dec, [
        state.createDecorator(INJECTABLE_MOD, 'InjectableFactory', args)
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