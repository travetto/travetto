import ts from 'typescript';

import { TransformerState, DecoratorMeta, OnClass, OnProperty, OnStaticMethod, DecoratorUtil, LiteralUtil, OnSetter } from '@travetto/transformer';

const INJECTABLE_IMPORT = '@travetto/di/src/decorator.ts';

/**
 * Injectable/Injection transformer
 */
export class InjectableTransformer {

  /**
   * Handle a specific declaration param/property
   */
  static processDeclaration(state: TransformerState, param: ts.ParameterDeclaration | ts.SetAccessorDeclaration | ts.PropertyDeclaration): ts.Expression[] {
    const existing = state.findDecorator(this, param, 'Inject', INJECTABLE_IMPORT);
    const args: ts.Expression[] = [];

    if (existing && ts.isCallExpression(existing.expression)) {
      args.push(...existing.expression.arguments);
    }

    const payload: { target?: unknown, qualifier?: unknown, optional?: boolean } = {};

    if (!!param.questionToken) {
      payload.optional = true;
    }

    const keyParam = ts.isSetAccessorDeclaration(param) ? param.parameters[0] : param;
    payload.target = state.getConcreteType(keyParam);
    args.unshift(state.fromLiteral(payload));

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
          if (resolvedType.key === 'managed') {
            const resolved = state.getOrImport(resolvedType);
            interfaces.push(resolved);
          }
        }
      }
    }

    // Add injectable decorator if not there
    const decl = state.findDecorator(this, node, 'Injectable', INJECTABLE_IMPORT);
    const args = decl && ts.isCallExpression(decl.expression) ? decl.expression.arguments : [undefined];

    return state.factory.updateClassDeclaration(node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_IMPORT, 'Injectable', ...args, LiteralUtil.extendObjectLiteral(ts.factory, {}, {
          interfaces
        })),
        state.createDecorator(INJECTABLE_IMPORT, 'InjectArgs', injectArgs)
      ]),
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
    const decl = state.findDecorator(this, node, 'Inject', INJECTABLE_IMPORT);

    // Doing decls
    return state.factory.updatePropertyDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_IMPORT, 'Inject', ...this.processDeclaration(state, node)),
      ], 0),
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
    const decl = state.findDecorator(this, node, 'Inject', INJECTABLE_IMPORT);

    const modifiers = DecoratorUtil.spliceDecorators(node, decl, [
      state.createDecorator(INJECTABLE_IMPORT, 'Inject', ...this.processDeclaration(state, node)),
    ], 0);

    // Doing decls
    return state.factory.updateSetAccessorDeclaration(
      node,
      modifiers,
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

    const parent = node.parent;
    if (ts.isObjectLiteralExpression(parent)) {
      return node;
    }

    const dec = dm?.dec;

    // Extract config
    const dependencies = node.parameters.map(x => this.processDeclaration(state, x));

    // Read target from config or resolve
    const config: { dependencies: unknown[], target?: unknown, qualifier?: unknown, src?: unknown } = {
      dependencies,
      src: parent.name,
    };
    let ret = state.resolveReturnType(node);
    if (ret.key === 'literal' && ret.ctor === Promise && ret.typeArguments) {
      ret = ret.typeArguments![0];
    }
    if (ret.key === 'managed') {
      config.target = state.getOrImport(ret);
    } else if (ret.key === 'foreign') {
      config.target = state.getForeignTarget(ret);
    }

    // Build decl
    const args = [...(dec && ts.isCallExpression(dec.expression) ? dec.expression.arguments : [undefined])];

    args.unshift(state.extendObjectLiteral(config));

    // Replace decorator
    return state.factory.updateMethodDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, dec, [
        state.createDecorator(INJECTABLE_IMPORT, 'InjectableFactory', ...args)
      ]),
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