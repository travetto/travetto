import ts from 'typescript';

import {
  TransformerState, DecoratorMeta, OnClass, OnProperty, OnStaticMethod, DecoratorUtil, LiteralUtil, OnSetter
} from '@travetto/transformer';
import { ForeignType } from '@travetto/transformer/src/resolver/types';

const INJECTABLE_MOD = '@travetto/di/src/decorator';

/**
 * Injectable/Injection transformer
 */
export class InjectableTransformer {

  static foreignTarget(state: TransformerState, ret: ForeignType): ts.Expression {
    return state.fromLiteral({
      Ⲑid: `${ret.source.split('node_modules')[1]}+${ret.name}`
    });
  }

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

    const payload: { target?: unknown, qualifier?: unknown, optional?: boolean } = {};

    if (!!param.questionToken) {
      payload.optional = true;
    }

    const keyParam = ts.isSetAccessorDeclaration(param) ? param.parameters[0] : param;
    const type = state.resolveType(keyParam);

    if (type.key === 'managed') {
      payload.target = state.getOrImport(type);
    } else if (type.key === 'foreign') {
      payload.target = this.foreignTarget(state, type);
    } else {
      const file = param.getSourceFile().fileName;
      const src = state.getFileImportName(file);
      throw new Error(`Unable to import non-external type: ${param.getText()} ${type.key}: ${src}`);
    }

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
    const decl = state.findDecorator(this, node, 'Injectable', INJECTABLE_MOD);
    const args = decl && ts.isCallExpression(decl.expression) ? decl.expression.arguments : [undefined];

    return state.factory.updateClassDeclaration(node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Injectable', ...args, LiteralUtil.extendObjectLiteral(ts.factory, {}, {
          interfaces
        })),
        state.createDecorator(INJECTABLE_MOD, 'InjectArgs', injectArgs)
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
    const decl = state.findDecorator(this, node, 'Inject', INJECTABLE_MOD);

    // Doing decls
    return state.factory.updatePropertyDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, decl, [
        state.createDecorator(INJECTABLE_MOD, 'Inject', ...this.processDeclaration(state, node)),
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
    const decl = state.findDecorator(this, node, 'Inject', INJECTABLE_MOD);

    const modifiers = DecoratorUtil.spliceDecorators(node, decl, [
      state.createDecorator(INJECTABLE_MOD, 'Inject', ...this.processDeclaration(state, node)),
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

    const dec = dm?.dec;

    // Extract config
    const dependencies = node.parameters.map(x => this.processDeclaration(state, x));

    // Read target from config or resolve
    const config: { dependencies: unknown[], target?: unknown, qualifier?: unknown, src?: unknown } = {
      dependencies,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      src: (node.parent as ts.ClassDeclaration).name,
    };
    const ret = state.resolveReturnType(node);
    if (ret.key === 'managed') {
      config.target = state.getOrImport(ret);
    } else if (ret.key === 'foreign') {
      config.target = this.foreignTarget(state, ret);
    }

    // Build decl
    const args = [...(dec && ts.isCallExpression(dec.expression) ? dec.expression.arguments : [undefined])];

    args.unshift(state.extendObjectLiteral(config));

    // Replace decorator
    return state.factory.updateMethodDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, dec, [
        state.createDecorator(INJECTABLE_MOD, 'InjectableFactory', ...args)
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