import * as ts from 'typescript';

import {
  TransformerState, DecoratorMeta, OnClass, OnProperty, OnStaticMethod, DecoratorUtil, LiteralUtil, TransformerId, OnSetter
} from '@travetto/transformer';

const INJECTABLE_MOD = '@travetto/di/src/decorator';

/**
 * Injectable/Injection transformer
 */
export class InjectableTransformer {

  static [TransformerId] = '@trv:di';

  /**
   * Handle a specific declaration param/property
   */
  static processDeclaration(state: TransformerState, param: ts.ParameterDeclaration | ts.SetAccessorDeclaration | ts.PropertyDeclaration): ts.Expression[] {
    const existing = state.findDecorator(this, param, 'Inject', INJECTABLE_MOD);

    if (!(existing || ts.isParameter(param))) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const callExpr = existing?.expression as ts.CallExpression;
    const args: ts.Expression[] = [...(callExpr?.arguments ?? [])];

    let optional = undefined;
    if (optional === undefined && !!param.questionToken) {
      optional = state.fromLiteral(true);
    }

    args.unshift(state.fromLiteral({
      target: state.getOrImport(state.resolveExternalType(ts.isSetAccessorDeclaration(param) ? param.parameters[0] : param)),
      optional
    }));

    return args;
  }

  /**
   * Mark class as Injectable
   */
  @OnClass('Injectable')
  static registerInjectable(state: TransformerState, node: ts.ClassDeclaration): typeof node {
    const cons = node.members.find((x): x is ts.ConstructorDeclaration => ts.isConstructorDeclaration(x));
    const injectArgs = cons &&
      state.fromLiteral(cons.parameters.map(x => this.processDeclaration(state, x)));

    // Extract all interfaces
    const interfaces: ts.Node[] = [];
    for (const clause of node.heritageClauses ?? []) {
      if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        for (const typeExpression of clause.types) {
          const resolvedType = state.resolveType(typeExpression);
          if (resolvedType.key === 'external') {
            const resolved = state.getOrImport(resolvedType);
            interfaces.push(resolved);
          }
        }
      }
    }

    // Add injectable decorator if not there
    const decl = state.findDecorator(this, node, 'Injectable', INJECTABLE_MOD);
    const args = decl && ts.isCallExpression(decl.expression) ? decl.expression.arguments : [undefined];

    return state.factory.updateClassDeclaration(node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Injectable', ...args, LiteralUtil.extendObjectLiteral(ts.factory, {}, {
          interfaces
        })),
        state.createDecorator(INJECTABLE_MOD, 'InjectArgs', injectArgs)
      ]),
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }

  /**
   * Handle Inject annotations for fields/args
   */
  @OnProperty('Inject')
  static registerInjectProperty(state: TransformerState, node: ts.PropertyDeclaration, dm?: DecoratorMeta): typeof node {
    const decl = state.findDecorator(this, node, 'Inject', INJECTABLE_MOD);

    // Doing decls
    return state.factory.updatePropertyDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Inject', ...this.processDeclaration(state, node)),
      ], 0),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );
  }

  /**
  * Handle Inject annotations for fields/args
  */
  @OnSetter('Inject')
  static registerInjectSetter(state: TransformerState, node: ts.SetAccessorDeclaration, dm?: DecoratorMeta): typeof node {
    const decl = state.findDecorator(this, node, 'Inject', INJECTABLE_MOD);

    // Doing decls
    return state.factory.updateSetAccessorDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Inject', ...this.processDeclaration(state, node)),
      ], 0),
      node.modifiers,
      node.name,
      node.parameters,
      node.body
    );
  }

  /**
   * Handle InjectableFactory creation
   */
  @OnStaticMethod('InjectableFactory')
  static registerFactory(state: TransformerState, node: ts.MethodDeclaration, dm?: DecoratorMeta): typeof node {
    if (!dm?.dec) {
      return node;
    }

    const dec = dm?.dec;

    // Extract config
    const dependencies = node.parameters.map(x => this.processDeclaration(state, x));

    // Read target from config or resolve
    let target;
    const ret = state.resolveReturnType(node);
    if (ret.key === 'external') {
      target = state.getOrImport(ret);
    }

    // Build decl
    const args = [...(dec && ts.isCallExpression(dec.expression) ? dec.expression.arguments : [undefined])];

    args.unshift(state.extendObjectLiteral({
      dependencies,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      src: (node.parent as ts.ClassDeclaration).name,
      target
    }));

    // Replace decorator
    return state.factory.updateMethodDeclaration(
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