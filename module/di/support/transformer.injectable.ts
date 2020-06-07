import * as ts from 'typescript';

import {
  TransformerState, DecoratorMeta, OnClass, OnProperty, OnStaticMethod, LiteralUtil
} from '@travetto/transformer';
import { DecoratorUtil } from '@travetto/transformer/src/util/decorator';

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

    let injectConfig = DecoratorUtil.getPrimaryArgument<ts.ObjectLiteralExpression>(existing);

    let original = undefined;

    const callExpr = existing?.expression as ts.CallExpression;
    if (callExpr) {
      const args = callExpr.arguments! ?? [];
      // Handle special case
      if (args.length && ts.isIdentifier(args[0])) {
        original = args[0];
        injectConfig = args[1] as ts.ObjectLiteralExpression;
      }
    }

    injectConfig = injectConfig ?? LiteralUtil.fromLiteral({});

    let optional = LiteralUtil.getObjectValue(injectConfig, 'optional');
    if (optional === undefined && !!param.questionToken) {
      optional = ts.createTrue();
    }

    return LiteralUtil.fromLiteral({
      original,
      target: state.getOrImport(state.resolveExternalType(param)),
      optional,
      qualifier: LiteralUtil.getObjectValue(injectConfig, 'qualifier')
    });
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
          config = LiteralUtil.fromLiteral({ qualifier: first });
        }
      }
    }

    return ts.updateClassDeclaration(node,
      DecoratorUtil.spliceDecorators(node, decl, [
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
        state.createDecorator(INJECTABLE_MOD, 'Inject', this.processDeclaration(state, node)!),
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
    let original: any;

    // Extract config
    const injectArgs = node.parameters.map(x => InjectableTransformer.processDeclaration(state, x)!);
    let injectConfig = DecoratorUtil.getPrimaryArgument<ts.Expression>(dec);

    if (injectConfig && ts.isIdentifier(injectConfig)) {
      original = injectConfig; // Shift to original
      injectConfig = undefined; // Config is empty
    }

    injectConfig = injectConfig ?? LiteralUtil.fromLiteral({});

    if (!ts.isObjectLiteralExpression(injectConfig)) {
      throw new Error('Unexpected InjectFactory config parameter');
    }

    // Read target from config or resolve
    let target = LiteralUtil.getObjectValue(injectConfig, 'target');
    if (!target) {  // Infer from typings
      const ret = state.resolveReturnType(node);
      if (ret.key === 'external') {
        target = state.getOrImport(ret);
      }
    }

    // Build decl
    const args = LiteralUtil.extendObjectLiteral({
      dependencies: injectArgs,
      src: (node.parent as ts.ClassDeclaration).name,
      target,
      original
    }, injectConfig);

    // Replace decorator
    return ts.createMethod(
      DecoratorUtil.spliceDecorators(node, dec, [
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