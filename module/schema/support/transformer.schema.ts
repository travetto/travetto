import ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta, DocUtil, DeclarationUtil, OnGetter, OnSetter
} from '@travetto/transformer';

import { SchemaTransformUtil } from './transformer/util.ts';

const inSchema = Symbol.for('@travetto/schema:schema');
const accessors = Symbol.for('@travetto/schema:accessors');

interface AutoState {
  [inSchema]?: boolean;
  [accessors]?: Set<string>;
}

/**
 * Processes `@Schema` to register class as a valid Schema
 */
export class SchemaTransformer {

  /**
   * Track schema on start
   */
  @OnClass('Schema')
  static startSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration, dec?: DecoratorMeta): ts.ClassDeclaration {
    state[inSchema] = true;
    state[accessors] = new Set();
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

    delete state[inSchema];
    delete state[accessors];

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
   * Handle all properties, while in schema
   */
  @OnProperty()
  static processSchemaField(state: TransformerState & AutoState, node: ts.PropertyDeclaration): ts.PropertyDeclaration {
    const ignore = state.findDecorator(this, node, 'Ignore');
    return state[inSchema] && !ignore && DeclarationUtil.isPublic(node) ?
      SchemaTransformUtil.computeField(state, node) : node;
  }

  /**
   * Handle getters
   */
  @OnGetter()
  static processSchemaGetter(state: TransformerState & AutoState, node: ts.GetAccessorDeclaration): ts.GetAccessorDeclaration {
    const ignore = state.findDecorator(this, node, 'Ignore');
    if (state[inSchema] && !ignore && DeclarationUtil.isPublic(node) && !state[accessors]?.has(node.name.getText())) {
      state[accessors]?.add(node.name.getText());
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
    if (state[inSchema] && !ignore && DeclarationUtil.isPublic(node) && !state[accessors]?.has(node.name.getText())) {
      state[accessors]?.add(node.name.getText());
      return SchemaTransformUtil.computeField(state, node);
    }
    return node;
  }
}