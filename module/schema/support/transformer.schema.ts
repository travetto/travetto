import ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DocUtil, DeclarationUtil, OnGetter, OnSetter
} from '@travetto/transformer';

import { SchemaTransformUtil } from './transformer/util.ts';

const InSchemaSymbol = Symbol();
const AccessorsSymbol = Symbol();

interface AutoState {
  [InSchemaSymbol]?: boolean;
  [AccessorsSymbol]?: Set<string>;
}

/**
 * Processes `@Schema` to register class as a valid Schema
 */
export class SchemaTransformer {

  /**
   * Track schema on start
   */
  @OnClass('Schema')
  static startSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    state[InSchemaSymbol] = true;
    state[AccessorsSymbol] = new Set();
    return node;
  }

  /**
   * Mark the end of the schema, document
   */
  @AfterClass('Schema')
  static finalizeSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    const modifiers = (node.modifiers ?? []).slice(0);

    const comments = DocUtil.describeDocs(node);

    if (!state.findDecorator(this, node, 'Schema', SchemaTransformUtil.SCHEMA_IMPORT)) {
      modifiers.unshift(state.createDecorator(SchemaTransformUtil.SCHEMA_IMPORT, 'Schema'));
    }

    if (comments.description) {
      modifiers.push(state.createDecorator(SchemaTransformUtil.COMMON_IMPORT, 'Describe', state.fromLiteral({
        title: comments.description
      })));
    }

    delete state[InSchemaSymbol];
    delete state[AccessorsSymbol];

    const schemaMethods = state.readDocTag(node, 'schemaMethods');
    let members = node.members;

    if (schemaMethods) {
      const methodSet = new Set(schemaMethods.flatMap(x => x.split(/\s*,\s*/g)));
      members = state.factory.createNodeArray(
        node.members.map(x => ts.isMethodDeclaration(x) && methodSet.has(x.name.getText()) ?
          state.factory.updateMethodDeclaration(
            x,
            x.modifiers,
            x.asteriskToken,
            x.name,
            x.questionToken,
            x.typeParameters,
            x.parameters.map(y => SchemaTransformUtil.computeField(state, y)),
            x.type,
            x.body
          ) : x)
      );
    }

    return state.factory.updateClassDeclaration(
      node,
      modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      members
    );
  }

  /**
   * Handle all properties, while in schema
   */
  @OnProperty()
  static processSchemaField(state: TransformerState & AutoState, node: ts.PropertyDeclaration): ts.PropertyDeclaration {
    const ignore = state.findDecorator(this, node, 'Ignore');
    return state[InSchemaSymbol] && !ignore && DeclarationUtil.isPublic(node) ?
      SchemaTransformUtil.computeField(state, node) : node;
  }

  /**
   * Handle getters
   */
  @OnGetter()
  static processSchemaGetter(state: TransformerState & AutoState, node: ts.GetAccessorDeclaration): ts.GetAccessorDeclaration {
    const ignore = state.findDecorator(this, node, 'Ignore');
    if (state[InSchemaSymbol] && !ignore && DeclarationUtil.isPublic(node) && !state[AccessorsSymbol]?.has(node.name.getText())) {
      state[AccessorsSymbol]?.add(node.name.getText());
      return SchemaTransformUtil.computeField(state, node);
    }
    return node;
  }

  /**
   * Handle setters
   */
  @OnSetter()
  static processSchemaSetter(state: TransformerState & AutoState, node: ts.SetAccessorDeclaration): ts.SetAccessorDeclaration {
    const ignore = state.findDecorator(this, node, 'Ignore');
    if (state[InSchemaSymbol] && !ignore && DeclarationUtil.isPublic(node) && !state[AccessorsSymbol]?.has(node.name.getText())) {
      state[AccessorsSymbol]?.add(node.name.getText());
      return SchemaTransformUtil.computeField(state, node);
    }
    return node;
  }
}