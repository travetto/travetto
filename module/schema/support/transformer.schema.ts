import ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DocUtil, DeclarationUtil,
  OnGetter, OnSetter, OnMethod, DecoratorUtil, OnStaticMethod, type DecoratorMeta
} from '@travetto/transformer';

import { SchemaTransformUtil } from './transformer/util.ts';

const CONSTRUCTOR_PROPERTY = 'CONSTRUCTOR';
const InSchema = Symbol();
const IsOptIn = Symbol();
const AccessorsSymbol = Symbol();
const AutoEnrollMethods = Symbol();

interface AutoState {
  [InSchema]?: boolean;
  [IsOptIn]?: boolean;
  [AutoEnrollMethods]?: Set<string>;
  [AccessorsSymbol]?: Set<string>;
}

/**
 * Processes `@Schema` to register class as a valid Schema
 */
export class SchemaTransformer {

  static isInvisible(state: AutoState & TransformerState, node: ts.Declaration, isStatic?: boolean): boolean {
    if (!state[InSchema] && !isStatic) {
      return true;
    }

    const ignore = state.findDecorator(this, node, 'Ignore');
    if (ignore) {
      return true;
    }

    const manuallyOpted = !!(
      state.findDecorator(this, node, 'Input') ??
      state.findDecorator(this, node, 'Field') ??
      state.findDecorator(this, node, 'Method')
    );
    if (manuallyOpted) {
      return false;
    }
    if (ts.isMethodDeclaration(node)) {
      if (!node.body || !state[AutoEnrollMethods]?.has(node.name.getText())) {
        return true;
      }
    }
    if (state[IsOptIn] || !DeclarationUtil.isPublic(node)) {
      return true;
    }
    return false;
  }

  /**
   * Track schema on start
   */
  @OnClass('Schema')
  static startSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    state[AccessorsSymbol] = new Set();
    state[AutoEnrollMethods] = new Set();
    state[InSchema] = true;

    // Determine auto enrol methods
    for (const item of state.getDecoratorList(node)) {
      if (item.targets?.includes('@travetto/schema:Schema')) {
        state[IsOptIn] ||= item.options?.includes('opt-in') ?? false;
        const methodEnrolls = item.options?.filter(item => item.startsWith('method:'))?.map(item => item.replace('method:', '')) ?? [];
        for (const method of methodEnrolls) {
          state[AutoEnrollMethods].add(method);
        }
      }
    }

    return node;
  }

  /**
   * Mark the end of the schema, document
   */
  @AfterClass('Schema')
  static finalizeSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    const comments = DocUtil.describeDocs(node);

    const existing = state.findDecorator(this, node, 'Schema', SchemaTransformUtil.SCHEMA_IMPORT);
    const cons = node.members.find(member => ts.isConstructorDeclaration(member));

    const attrs: Record<string, string | boolean | ts.Expression | number | object | unknown[]> = {};

    if (comments.description) {
      attrs.description = comments.description;
    }

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

    if (interfaces.length > 0) {
      attrs.interfaces = interfaces;
    }

    if (cons) {
      attrs.methods = {
        [CONSTRUCTOR_PROPERTY]: {
          parameters: cons.parameters
            .map((parameter, i) => SchemaTransformUtil.computeInputDecoratorParams(state, parameter, { index: i }))
            .map(expr => state.extendObjectLiteral({}, ...expr)),
        }
      };
    }

    let params = DecoratorUtil.getArguments(existing) ?? [];
    if (Object.keys(attrs).length) {
      params = [...params, state.fromLiteral(attrs)];
    }

    delete state[InSchema];
    delete state[IsOptIn];
    delete state[AccessorsSymbol];
    delete state[AutoEnrollMethods];

    return state.factory.updateClassDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, existing, [
        state.createDecorator(SchemaTransformUtil.SCHEMA_IMPORT, 'Schema', ...params)
      ]),
      node.name,
      node.typeParameters,
      node.heritageClauses,
      node.members
    );
  }

  /**
   * Handle explicitly registered methods
   */
  @OnMethod()
  @OnStaticMethod()
  static processSchemaMethod(state: TransformerState & AutoState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (
      this.isInvisible(state, node, node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)) &&
      !state[AutoEnrollMethods]?.has(node.name.getText())) {
      return node;
    }

    const existing = state.findDecorator(this, node, 'Method', SchemaTransformUtil.METHOD_IMPORT);
    const comments = DocUtil.describeDocs(node);
    const params = DecoratorUtil.getArguments(existing) ?? [];

    if (comments.description) {
      params.unshift(state.fromLiteral({ description: comments.description }));
    }
    if (DeclarationUtil.isStatic(node)) {
      params.push(state.fromLiteral({ isStatic: true }));
    }
    params.push(...SchemaTransformUtil.computeReturnTypeDecoratorParams(state, node));

    return state.factory.updateMethodDeclaration(
      node,
      DecoratorUtil.spliceDecorators(node, existing, [
        state.createDecorator(SchemaTransformUtil.METHOD_IMPORT, 'Method', ...params)
      ]),
      node.asteriskToken,
      node.name,
      node.questionToken,
      node.typeParameters,
      node.parameters.map((parameter, i) => SchemaTransformUtil.computeInput(state, parameter, { index: i })),
      node.type,
      node.body
    );
  }

  /**
   * Handle all properties, while in schema
   */
  @OnProperty()
  static processSchemaField(state: TransformerState & AutoState, node: ts.PropertyDeclaration): ts.PropertyDeclaration {
    if (this.isInvisible(state, node)) {
      return node;
    }
    return SchemaTransformUtil.computeInput(state, node);
  }

  /**
   * Handle getters
   */
  @OnGetter()
  static processSchemaGetter(state: TransformerState & AutoState, node: ts.GetAccessorDeclaration): ts.GetAccessorDeclaration {
    if (this.isInvisible(state, node) || DeclarationUtil.isStatic(node)) {
      return node;
    }
    if (state[AccessorsSymbol]?.has(node.name.getText())) {
      return node;
    } else {
      state[AccessorsSymbol]?.add(node.name.getText());
      return SchemaTransformUtil.computeInput(state, node);
    }
  }

  /**
   * Handle setters
   */
  @OnSetter()
  static processSchemaSetter(state: TransformerState & AutoState, node: ts.SetAccessorDeclaration): ts.SetAccessorDeclaration {
    if (this.isInvisible(state, node) || DeclarationUtil.isStatic(node)) {
      return node;
    }
    if (state[AccessorsSymbol]?.has(node.name.getText())) {
      return node;
    } else {
      state[AccessorsSymbol]?.add(node.name.getText());
      return SchemaTransformUtil.computeInput(state, node);
    }
  }
}