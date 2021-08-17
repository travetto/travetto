import * as ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta, DocUtil, DeclarationUtil, TransformerId, OnGetter, OnSetter
} from '@travetto/transformer';

import { SchemaTransformUtil } from './transform-util';

const inSchema = Symbol.for('@trv:schema/schema');
const accessors = Symbol.for('@trv:schema/schema');

interface AutoState {
  [inSchema]?: boolean;
  [accessors]?: Set<string>;
}

const SCHEMA_MOD = '@travetto/schema/src/decorator/schema';
const COMMON_MOD = '@travetto/schema/src/decorator/common';

/**
 * Processes `@Schema` to register class as a valid Schema
 */
export class SchemaTransformer {

  static [TransformerId] = '@trv:schema';

  /**
   * Track schema on start
   */
  @OnClass('Schema')
  static startSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration, dec?: DecoratorMeta) {
    state[inSchema] = true;
    state[accessors] = new Set();
    return node;
  }

  /**
   * Mark the end of the schema, document
   */
  @AfterClass('Schema')
  static finalizeSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators ?? [])];

    const comments = DocUtil.describeDocs(node);

    if (!state.findDecorator(this, node, 'Schema', SCHEMA_MOD)) {
      decls.unshift(state.createDecorator(SCHEMA_MOD, 'Schema'));
    }

    if (comments.description) {
      decls.push(state.createDecorator(COMMON_MOD, 'Describe', state.fromLiteral({
        title: comments.description
      })));
    }

    delete state[inSchema];
    delete state[accessors];

    return state.factory.updateClassDeclaration(
      node,
      decls,
      node.modifiers,
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
  static processSchemaField(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    const ignore = state.findDecorator(this, node, 'Ignore');
    return state[inSchema] && !ignore && DeclarationUtil.isPublic(node) ?
      SchemaTransformUtil.computeField(state, node) : node;
  }

  /**
   * Handle getters
   */
  @OnGetter()
  static processSchemaGetter(state: TransformerState & AutoState, node: ts.GetAccessorDeclaration) {
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
  static processSchemaSetter(state: TransformerState & AutoState, node: ts.SetAccessorDeclaration) {
    const ignore = state.findDecorator(this, node, 'Ignore');
    if (state[inSchema] && !ignore && DeclarationUtil.isPublic(node) && !state[accessors]?.has(node.name.getText())) {
      state[accessors]?.add(node.name.getText());
      return SchemaTransformUtil.computeField(state, node);
    }
    return node;
  }
}