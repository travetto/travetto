import * as ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta, DocUtil, DeclarationUtil, TransformerId, OnMethod, OnParameter, AfterMethod
} from '@travetto/transformer';
import { SchemaTransformUtil } from './lib';

const inSchema = Symbol.for('@trv:schema/schema');
const inValidation = Symbol.for('@trv:schema/validate');

interface AutoState {
  [inSchema]?: boolean;
  [inValidation]?: boolean;
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
      SchemaTransformUtil.computeField(state, node) : node;
  }

  /**
   * Track method validation start
   */
  @OnMethod('Validate')
  static startMethodValidation(state: AutoState & TransformerState, node: ts.MethodDeclaration, dec?: DecoratorMeta) {
    state[inValidation] = true;
    return node;
  }


  /**
   * Mark the end of the validation, document
   */
  @AfterMethod('Validate')
  static finalizeValidate(state: AutoState & TransformerState, node: ts.MethodDeclaration) {
    const decls = [...(node.decorators ?? [])];
    if (!state.findDecorator(this, node, 'Validate', SCHEMA_MOD)) {
      decls.unshift(state.createDecorator(SCHEMA_MOD, 'Validate'));
    }

    delete state[inSchema];
    return state.factory.updateMethodDeclaration(
      node,
      decls,
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

  /**
   * Handle all parameters, while in validation
   */
  @OnParameter()
  static processParameter(state: TransformerState & AutoState, node: ts.ParameterDeclaration) {
    return state[inValidation] ? SchemaTransformUtil.computeField(state, node) : node;
  }
}