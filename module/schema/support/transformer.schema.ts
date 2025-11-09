import ts from 'typescript';

import { TransformerState, OnProperty, OnClass, AfterClass, DocUtil, DeclarationUtil, OnGetter, OnSetter, OnMethod, DecoratorUtil } from '@travetto/transformer';

import { SchemaTransformUtil } from './transformer/util.ts';

const InSchemaSymbol = Symbol();
const AccessorsSymbol = Symbol();
const AutoEnrollMethods = Symbol();

interface AutoState {
  [InSchemaSymbol]?: boolean;
  [AutoEnrollMethods]?: Set<string>;
  [AccessorsSymbol]?: Set<string>;
}

/**
 * Processes `@Schema` to register class as a valid Schema
 */
export class SchemaTransformer {

  static isInvisible(state: AutoState & TransformerState, node: ts.Declaration): boolean {
    if (!state[InSchemaSymbol] || !DeclarationUtil.isPublic(node)) {
      return true;
    }
    const ignore = state.findDecorator(this, node, 'Ignore');
    return !!ignore;
  }

  /**
   * Track schema on start
   */
  @OnClass('Schema')
  static startSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    state[InSchemaSymbol] = true;
    state[AccessorsSymbol] = new Set();
    state[AutoEnrollMethods] = new Set();

    // Determine auto enrol methods
    for (const item of state.getDecoratorList(node)) {
      if (item.targets?.includes('@travetto/schema:Schema')) {
        for (const opt of item.options ?? []) {
          state[AutoEnrollMethods].add(opt);
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
    const cons = node.members.find(x => ts.isConstructorDeclaration(x));

    const params = DecoratorUtil.getArguments(existing) ?? [];

    if (comments.description) {
      params.unshift(state.fromLiteral({ title: comments.description }));
    }

    if (cons) {
      params.push(state.fromLiteral({
        methods: {
          constructor: {
            parameters: cons.parameters.map(p => SchemaTransformUtil.computeInputDecoratorParams(state, p))
          }
        }
      }));
    }

    const newSchemaDec = state.createDecorator(SchemaTransformUtil.SCHEMA_IMPORT, 'Schema', ...params);
    const modifiers = [...node.modifiers?.filter(x => x !== existing) ?? [], newSchemaDec];

    delete state[InSchemaSymbol];
    delete state[AccessorsSymbol];

    return state.factory.updateClassDeclaration(
      node,
      modifiers,
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
  static processSchemaMethod(state: TransformerState & AutoState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    if (this.isInvisible(state, node)) {
      return node;
    }
    const existing = state.findDecorator(this, node, 'Method', SchemaTransformUtil.METHOD_IMPORT);

    if (!existing && !state[AutoEnrollMethods]?.has('*') && !state[AutoEnrollMethods]?.has(node.name.getText())) {
      return node;
    }

    const comments = DocUtil.describeDocs(node);
    const params = DecoratorUtil.getArguments(existing) ?? [];

    if (comments.description) {
      params.unshift(state.fromLiteral({ title: comments.description }));
    }

    const newSchemaDec = state.createDecorator(SchemaTransformUtil.METHOD_IMPORT, 'Method', ...params);
    const modifiers = [...node.modifiers?.filter(x => x !== existing) ?? [], newSchemaDec];

    return state.factory.updateMethodDeclaration(
      node,
      modifiers,
      node.asteriskToken,
      node.name,
      node.questionToken,
      node.typeParameters,
      node.parameters.map(y => SchemaTransformUtil.computeInput(state, y)),
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
    if (this.isInvisible(state, node)) {
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
    if (this.isInvisible(state, node)) {
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