import * as ts from 'typescript';

import {
  TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta,
  AnyType,
  DocUtil,
  LiteralUtil,
  CoreUtil
} from '@travetto/transformer';

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
   * Produce final type given transformer type
   */
  static toFinalType(state: TransformerState, type: AnyType): ts.Expression {
    switch (type.key) {
      case 'pointer': return this.toFinalType(state, type.target);
      case 'external': {
        const res = state.getOrImport(type);
        return res;
      }
      case 'tuple': return LiteralUtil.fromLiteral(type.subTypes.map(x => this.toFinalType(state, x)!));
      case 'literal': {
        if ((type.ctor === Array || type.ctor === Set) && type.typeArguments?.length) {
          return LiteralUtil.fromLiteral([this.toFinalType(state, type.typeArguments[0])]);
        } else {
          return ts.createIdentifier(type.ctor!.name!);
        }
      }
      case 'shape': {
        const out: Record<string, ts.Expression | undefined> = {};
        for (const el of Object.keys(type.fieldTypes)) {
          out[el] = this.toFinalType(state, type.fieldTypes[el]);
        }
        return LiteralUtil.fromLiteral(type);
      }
      case 'union': {
        if (type.commonType) {
          return this.toFinalType(state, type.commonType);
        }
      }
    }
    return ts.createIdentifier('Object');
  }

  /**
   * Compute property information from declaration
   */
  static computeProperty(state: AutoState & TransformerState, node: ts.PropertyDeclaration) {

    const typeExpr = state.resolveType(node);
    const properties = [];

    if (!node.questionToken && !typeExpr.undefinable && !node.initializer) {
      properties.push(ts.createPropertyAssignment('required', LiteralUtil.fromLiteral({ active: true })));
    }

    // If we have a union type
    if (typeExpr.key === 'union') {
      const values = typeExpr.subTypes.map(x => x.key === 'literal' ? x.value : undefined)
        .filter(x => x !== undefined && x !== null);

      if (values.length === typeExpr.subTypes.length) {
        properties.push(ts.createPropertyAssignment('enum', LiteralUtil.fromLiteral({
          values,
          message: `{path} is only allowed to be "${values.join('" or "')}"`
        })));
      }
    }

    const resolved = this.toFinalType(state, typeExpr);
    const params: ts.Expression[] = resolved ? [resolved] : [];

    if (properties.length) {
      params.push(ts.createObjectLiteral(properties));
    }

    const dec = state.createDecorator(FIELD_MOD, 'Field', ...params);
    const newDecs = [...(node.decorators ?? []), dec];

    const comments = DocUtil.describeDocs(node);
    if (comments.description) {
      newDecs.push(state.createDecorator(COMMON_MOD, 'Describe', LiteralUtil.fromLiteral({
        description: comments.description
      })));
    }

    const result = ts.updateProperty(node,
      ts.createNodeArray(newDecs),
      node.modifiers,
      node.name,
      node.questionToken,
      node.type,
      node.initializer
    );

    return result;
  }

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
      ts.createNodeArray(decls),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
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
      this.computeProperty(state, node) : node;
  }
}