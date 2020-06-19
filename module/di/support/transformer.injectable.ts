import * as ts from 'typescript';

import {
  TransformerState, DecoratorMeta, OnClass, OnProperty, OnStaticMethod, LiteralUtil, DecoratorUtil
} from '@travetto/transformer';

const INJECTABLE_MOD = require.resolve('../src/decorator');

/**
 * Injectable/Injection transformer
 */
export class InjectableTransformer {

  /**
   * Handle a specific declaration param/property
   */
  static processDeclaration(state: TransformerState, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
    const existing = state.findDecorator(param, '@trv:di/Inject', 'Inject', INJECTABLE_MOD);

    if (!(existing || ts.isParameter(param))) {
      return;
    }

    const callExpr = existing?.expression as ts.CallExpression;
    const args: ts.Expression[] = [...(callExpr?.arguments ?? [])];

    let optional = undefined;
    if (optional === undefined && !!param.questionToken) {
      optional = ts.createTrue();
    }

    args.unshift(LiteralUtil.fromLiteral({
      target: state.getOrImport(state.resolveExternalType(param)),
      optional
    }));

    return args;
  }

  /**
   * Mark class as Injectable
   */
  @OnClass('@trv:di/Injectable')
  static handleClass(state: TransformerState, node: ts.ClassDeclaration) {
    const cons = node.members.find(x => ts.isConstructorDeclaration(x)) as ts.ConstructorDeclaration;
    const injectArgs = cons &&
      LiteralUtil.fromLiteral(cons.parameters.map(x => InjectableTransformer.processDeclaration(state, x)));

    // Add injectable decorator if not there
    const decl = state.findDecorator(node, '@trv:di/Injectable', 'Injectable', INJECTABLE_MOD);
    const args = decl && ts.isCallExpression(decl.expression) ? decl.expression.arguments : [undefined];

    return ts.updateClassDeclaration(node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Injectable', ...args),
        state.createDecorator(INJECTABLE_MOD, 'InjectArgs', injectArgs)
      ]),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      node.members
    );
  }

  /**
   * Handle Inject annotations for fields/args
   */
  @OnProperty('@trv:di/Inject')
  static handleProperty(state: TransformerState, node: ts.PropertyDeclaration, dm?: DecoratorMeta) {
    const decl = state.findDecorator(node, '@trv:di/Inject', 'Inject', INJECTABLE_MOD);

    // Doing decls
    return ts.updateProperty(
      node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Inject', ...this.processDeclaration(state, node)!),
      ], 0),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
  }

  /**
   * Handle InjectableFactory creation
   */
  @OnStaticMethod('@trv:di/InjectableFactory')
  static handleFactory(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta) {
    if (!dm?.dec) {
      return node;
    }

    const dec = dm?.dec;

    // Extract config
    const dependencies = node.parameters.map(x => InjectableTransformer.processDeclaration(state, x)!);

    // Read target from config or resolve
    let target;
    const ret = state.resolveReturnType(node);
    if (ret.key === 'external') {
      target = state.getOrImport(ret);
    }

    // Build decl
    const args = [...(dec && ts.isCallExpression(dec.expression) ? dec.expression.arguments : [undefined])];

    args.unshift(LiteralUtil.extendObjectLiteral({
      dependencies,
      src: (node.parent as ts.ClassDeclaration).name,
      target
    }));

    // Replace decorator
    return ts.updateMethod(
      node,
      DecoratorUtil.spliceDecorators(node, dec, [
        state.createDecorator(INJECTABLE_MOD, 'InjectableFactory', ...args)
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