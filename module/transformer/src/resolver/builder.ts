/* eslint-disable no-bitwise */
import * as ts from 'typescript';
import { dirname } from 'path';

import { FsUtil } from '@travetto/boot';
import { Util } from '@travetto/base';

import { TransformUtil } from '../util';
import { AnyType } from './types';

/**
 * List of global types that can be parameterized
 */
const GLOBAL_COMPLEX: Record<string, Function> = {
  Array, Promise, Set, Map, ReadonlyArray: Array,
  Iterator: function Iterator() { },
  Iterable: function Iterable() { },
  IterableIterator: function IterableIterator() { },
  AsyncIterator: function AsyncIterator() { },
  PropertyDescriptor: Object,
  TypedPropertyDescriptor: Object
};

/**
 * List of global types that are simple
 */
const SIMPLE_NAMES: Record<string, string> = { String: 'string', Number: 'number', Boolean: 'boolean', Object: 'object' };
const GLOBAL_SIMPLE: Record<string, Function> = {
  RegExp, Date, Number, Boolean, String, Function, Object, Error,
  PromiseConstructor: Promise.constructor
};

/**
 * Type categorizer, input for builder
 */
export function TypeCategorize(checker: ts.TypeChecker, type: ts.Type) {
  const flags = type.getFlags();
  const objectFlags = TransformUtil.getObjectFlags(type) ?? 0;

  if (flags & ts.TypeFlags.Void) {
    return 'void';
  } else if (flags & ts.TypeFlags.Undefined) {
    return 'undefined';
  } else if (TransformUtil.readJSDocTags(type, 'concrete').length) {
    return 'concrete';
  } else if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { // Any or unknown
    return 'unknown';
  } else if (objectFlags & ts.ObjectFlags.Reference && !TransformUtil.getSymbol(type)) { // Tuple type?
    return 'tuple';
  } else if (objectFlags & ts.ObjectFlags.Anonymous) {
    return 'shape';
  } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
    // Handle target types
    if ('target' in type && type['target']) {
      type = type['target'] as ts.Type;
    }
    if (!type.isClass()) { // Real type
      const source = TransformUtil.getPrimaryDeclarationFromNode(type, checker)?.getSourceFile().fileName!;
      if (source.includes('typescript/lib')) { // Global Type
        return 'literal';
      } else {
        return 'shape';
      }
    }
    return 'external';
  } else if (flags & (
    ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral |
    ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral |
    ts.TypeFlags.String | ts.TypeFlags.StringLiteral |
    ts.TypeFlags.Void | ts.TypeFlags.Undefined
  )) {
    return 'literal';
  } else if (type.isUnion()) {
    return 'union';
  } else if (objectFlags & ts.ObjectFlags.Tuple) {
    return 'tuple';
  } else if (type.isLiteral()) {
    return 'shape';
  }
  return 'unknown';
}

type Category = ReturnType<typeof TypeCategorize>;
type Builder = (checker: ts.TypeChecker, type: ts.Type, alias?: ts.Symbol) => AnyType | undefined;

/**
 * Type builder
 */
export const TypeBuilder: Record<Category, Builder> = {
  unknown: (checker, type) => undefined,
  undefined: (checker, type) => ({ key: 'literal', name: 'undefined', ctor: undefined }),
  void: (checker, type) => ({ key: 'literal', name: 'void', ctor: undefined }),
  tuple: (checker, type) => ({ key: 'tuple', typeInfo: TransformUtil.getAllTypeArguments(checker, type), tupleTypes: [] }),
  literal: (checker, type) => {
    // Handle void/undefined
    const name = TransformUtil.getTypeAsString(checker, type) ?? '';
    const complexName = TransformUtil.getSymbolName(type) ?? '';

    if (name in GLOBAL_SIMPLE) {
      const cons = GLOBAL_SIMPLE[name];
      const ret = TransformUtil.isLiteralType(type) ? Util.coerceType(type.value, cons as typeof String, false) :
        undefined;

      return {
        key: 'literal',
        name: SIMPLE_NAMES[cons.name] ?? cons.name,
        ctor: cons,
        value: ret
      };
    } else if (complexName in GLOBAL_COMPLEX) {
      const cons = GLOBAL_COMPLEX[complexName];
      return {
        key: 'literal',
        name: cons.name,
        ctor: cons,
        typeInfo: TransformUtil.getAllTypeArguments(checker, type)
      };
    }
  },
  external: (checker, type) => {
    const decl = TransformUtil.getPrimaryDeclarationFromNode(type, checker);
    const source = decl?.getSourceFile().fileName!;
    const name = TransformUtil.getSymbolName(type);
    const comments = TransformUtil.readJSDocs(type);

    const obj: AnyType = { key: 'external', name, source, comment: comments.description };

    // Handle target types
    if ('target' in type && type['target']) {
      type = type['target'] as ts.Type;
    }

    obj.typeInfo = TransformUtil.getAllTypeArguments(checker, type);
    return obj;
  },
  union: (checker, type) => {
    const uType = type as ts.UnionType;
    const undefinable = uType.types.some(x => (x.getFlags() & ts.TypeFlags.Undefined));
    const nullable = uType.types.some(x => x.getFlags() & ts.TypeFlags.Null);
    const remainder = uType.types.filter(x => !(x.getFlags() & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    const name = TransformUtil.getSymbolName(type);
    return { key: 'union', name, undefinable, nullable, typeInfo: remainder, unionTypes: [] };
  },
  shape: (checker, type, alias?) => {
    const docs = TransformUtil.readJSDocs(type);
    const fieldNodes: Record<string, ts.Type> = {};
    const name = TransformUtil.getSymbolName(alias ?? type);
    for (const member of checker.getPropertiesOfType(type)) {
      const memberType = checker.getTypeAtLocation(
        TransformUtil.getPrimaryDeclarationFromNode(member, checker)
      );
      if (memberType.getCallSignatures().length) {
        continue;
      }
      fieldNodes[member.getName()] = memberType;
    }
    return { key: 'shape', name, comment: docs.description, typeInfo: fieldNodes, fields: {} };
  },
  concrete: (checker, type) => {
    const tags = TransformUtil.readJSDocTags(type, 'concrete');
    if (tags.length) {
      const parts = tags[0].split(':');
      const fileName = TransformUtil.getPrimaryDeclaration(TransformUtil.getDeclarations(type))?.getSourceFile().fileName;
      if (parts.length === 1) {
        parts.unshift('.');
      }
      const source = parts[0] === '.' ? fileName : FsUtil.resolveUnix(dirname(fileName), parts[0]);
      return { key: 'external', name: parts[1], source };
    }
  }
};