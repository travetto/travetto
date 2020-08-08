import * as ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta, DocUtil, DeclarationUtil
} from '@travetto/transformer';
import { SchemaTransformUtil } from './lib';

const inSchema = Symbol.for('@trv:schema/valid');

interface AutoState {
  [inSchema]?: boolean;
}

const SCHEMA_MOD = require.resolve('../src/decorator/schema');
const FIELD_MOD = require.resolve('../src/decorator/field');
const COMMON_MOD = require.resolve('../src/decorator/common');

/**
 * Processes `@Schema` to register class as a valid Schema
 */
export class SchemaTransformer {

  static key = '@trv:schema';

  /**
   * Track schema on start
   */
  @OnClass('Schema')
  static startSchema(state: AutoState & TransformerState, node: ts.ClassDeclaration, dec?: DecoratorMeta) {
    state[inSchema] = true;
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
      SchemaTransformUtil.computeProperty(state, node) : node;
  }
}