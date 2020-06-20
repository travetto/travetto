import * as ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta,
  DocUtil,
  LiteralUtil,
  CoreUtil
} from '@travetto/transformer';
import { SchemaTransformUtil } from './lib';

const hasSchema = Symbol.for('@trv:schema/has');
const inSchema = Symbol.for('@trv:schema/valid');

interface AutoState {
  [hasSchema]?: boolean;
  [inSchema]?: boolean;
}

const SCHEMA_MOD = require.resolve('../src/decorator/schema');
const FIELD_MOD = require.resolve('../src/decorator/field');
const COMMON_MOD = require.resolve('../src/decorator/common');

/**
 * Processes `@Schema` to register class as a valid Schema
 */
export class SchemaTransformer {

  /**
   * Track schema on start
   */
  @OnClass('@trv:schema/Schema')
  static handleClassBefore(state: AutoState & TransformerState, node: ts.ClassDeclaration, dec?: DecoratorMeta) {
    state[inSchema] = true;
    state[hasSchema] = !!state.findDecorator(node, '@trv:schema/Schema', 'Schema', SCHEMA_MOD);
    return node;
  }

  /**
   * Mark the end of the schema, document
   */
  @AfterClass('@trv:schema/Schema')
  static handleClassAfter(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators ?? [])];

    const comments = DocUtil.describeDocs(node);

    if (!state[hasSchema]) {
      decls.unshift(state.createDecorator(SCHEMA_MOD, 'Schema'));
    }

    if (comments.description) {
      decls.push(state.createDecorator(COMMON_MOD, 'Describe', LiteralUtil.fromLiteral({
        title: comments.description
      })));
    }

    delete state[inSchema];
    delete state[hasSchema];

    return ts.updateClassDeclaration(
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
  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    const ignore = state.findDecorator(node, '@trv:schema/Ignore', 'Ignore', FIELD_MOD);
    return state[inSchema] && !ignore && CoreUtil.isPublic(node) ?
      SchemaTransformUtil.computeProperty(state, node) : node;
  }
}