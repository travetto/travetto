import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, OnProperty, OnClass, AfterClass, DecoratorMeta, res
} from '@travetto/compiler/src/transform-support';

const hasSchema = Symbol('hasSchema');

interface AutoState {
  [hasSchema]?: boolean;
}

const SCHEMA_MOD = require.resolve('../src/decorator/schema');
const FIELD_MOD = require.resolve('../src/decorator/field');
const COMMON_MOD = require.resolve('../src/decorator/common');

// TODO: Document
export class SchemaTransformer {

  static toFinalType(state: TransformerState, type: res.Type): ts.Expression {
    if (res.isExternalType(type)) {
      return state.getOrImport(type);
    } else if (res.isTupleType(type)) {
      return TransformUtil.fromLiteral(type.tupleTypes.map(x => this.toFinalType(state, x)!));
    } else if (res.isLiteralType(type)) {
      if (type.ctor === Array && type.typeArguments?.length) {
        return TransformUtil.fromLiteral([this.toFinalType(state, type.typeArguments[0])]);
      } else {
        return ts.createIdentifier(type.ctor!.name!);
      }
    } else if (res.isUnionType(type)) {
      if (type.commonType) {
        return this.toFinalType(state, type.commonType);
      }
    } else if (res.isShapeType(type)) {
      const out: Record<string, ts.Expression | undefined> = {};
      for (const el of Object.keys(type.fields)) {
        out[el] = this.toFinalType(state, type.fields[el]);
      }
      console.debug('Shapely shape', type);
      return TransformUtil.fromLiteral(type);
    }
    return ts.createIdentifier('Object');
  }

  // TODO: Full rewrite
  static computeProperty(state: AutoState & TransformerState, node: ts.PropertyDeclaration) {

    const typeExpr = state.resolveType(node);
    const properties = [];

    if (!node.questionToken && !typeExpr.undefinable) {
      properties.push(ts.createPropertyAssignment('required', TransformUtil.fromLiteral({ active: true })));
    }

    // If we have a union type
    if (res.isUnionType(typeExpr)) {
      const values = typeExpr.unionTypes.map(x => res.isLiteralType(x) ? x.value : undefined).filter(x => x !== undefined && x !== null);

      properties.push(ts.createPropertyAssignment('enum', TransformUtil.fromLiteral({
        values,
        message: `{path} is only allowed to be "${values.join('" or "')}"`
      })));
    }

    const resolved = this.toFinalType(state, typeExpr);
    const params: ts.Expression[] = resolved ? [resolved] : [];

    if (properties.length) {
      params.push(ts.createObjectLiteral(properties));
    }

    const dec = state.createDecorator(FIELD_MOD, 'Field', ...params);
    const newDecs = [...(node.decorators ?? []), dec];

    const comments = state.readJSDocs(node);
    if (comments.description) {
      newDecs.push(state.createDecorator(COMMON_MOD, 'Describe', TransformUtil.fromLiteral({
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

  @OnClass('trv/schema/Schema')
  static handleClassBefore(state: AutoState & TransformerState, node: ts.ClassDeclaration, dec?: DecoratorMeta) {
    state[hasSchema] = true;
    return node;
  }

  @AfterClass('trv/schema/Schema')
  static handleClassAfter(state: AutoState & TransformerState, node: ts.ClassDeclaration) {
    const decls = [...(node.decorators ?? [])];

    const comments = state.readJSDocs(node);

    if (!state[hasSchema]) {
      decls.unshift(state.createDecorator(SCHEMA_MOD, 'Schema'));
    }

    if (comments.description) {
      decls.push(state.createDecorator(COMMON_MOD, 'Describe', TransformUtil.fromLiteral({
        title: comments.description
      })));
    }

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

  @OnProperty()
  static handleProperty(state: TransformerState & AutoState, node: ts.PropertyDeclaration) {
    const ignore = state.findDecorator(node, 'trv/schema/Ignore', 'Ignore', FIELD_MOD);
    const isPublic = !(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.NonPublicAccessibilityModifier); // eslint-disable-line no-bitwise
    return state[hasSchema] && !ignore && isPublic ?
      this.computeProperty(state, node) : node;
  }
}