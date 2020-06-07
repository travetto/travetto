/* eslint-disable no-bitwise */
import * as ts from 'typescript';
import { dirname } from 'path';

import { FsUtil } from '@travetto/boot';
import { Util } from '@travetto/base';

import { TransformUtil } from '../util';
import { Type, AnyType, UnionType } from './types';

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

type Category = 'void' | 'undefined' | 'concrete' | 'unknown' | 'tuple' | 'shape' | 'literal' | 'external' | 'union';

/**
 * Type categorizer, input for builder
 */
export function TypeCategorize(checker: ts.TypeChecker, type: ts.Type): { category: Category, type: ts.Type } {
  const flags = type.getFlags();
  const objectFlags = TransformUtil.getObjectFlags(type) ?? 0;

  if (flags & ts.TypeFlags.Void) {
    return { category: 'void', type };
  } else if (flags & ts.TypeFlags.Undefined) {
    return { category: 'undefined', type };
  } else if (TransformUtil.readDocTag(type, 'concrete').length) {
    return { category: 'concrete', type };
  } else if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { // Any or unknown
    return { category: 'unknown', type };
  } else if (objectFlags & ts.ObjectFlags.Reference && !TransformUtil.getSymbol(type)) { // Tuple type?
    return { category: 'tuple', type };
  } else if (objectFlags & ts.ObjectFlags.Anonymous) {
    return { category: 'shape', type };
  } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
    let resolvedType = type;
    if ('target' in resolvedType && resolvedType['target']) {
      resolvedType = resolvedType['target'] as ts.Type;
    }

    if (!resolvedType.isClass()) { // Real type
      const source = TransformUtil.findSource(resolvedType);
      if (source && source.fileName.includes('typescript/lib')) { // Global Type
        return { category: 'literal', type };
      } else {
        return { category: 'shape', type: resolvedType };
      }
    }
    return { category: 'external', type: resolvedType };
  } else if (flags & (
    ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral |
    ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral |
    ts.TypeFlags.String | ts.TypeFlags.StringLiteral |
    ts.TypeFlags.Void | ts.TypeFlags.Undefined
  )) {
    return { category: 'literal', type };
  } else if (type.isUnion()) {
    return { category: 'union', type };
  } else if (objectFlags & ts.ObjectFlags.Tuple) {
    return { category: 'tuple', type };
  } else if (type.isLiteral()) {
    return { category: 'shape', type };
  }
  return { category: 'unknown', type };
}

/**
 * Type builder
 */
export const TypeBuilder: {
  [K in Category]: {
    build(checker: ts.TypeChecker, type: ts.Type, alias?: ts.Symbol): AnyType | undefined;
    finalize?(type: Type<K>): AnyType;
  }
} = {
  unknown: {
    build: (checker, type) => undefined
  },
  undefined: {
    build: (checker, type) => ({ key: 'literal', name: 'undefined', ctor: undefined })
  },
  void: {
    build: (checker, type) => ({ key: 'literal', name: 'void', ctor: undefined })
  },
  tuple: {
    build: (checker, type) => ({ key: 'tuple', tsTupleTypes: TransformUtil.getAllTypeArguments(checker, type), subTypes: [] })
  },
  literal: {
    build: (checker, type) => {
      // Handle void/undefined
      const name = TransformUtil.getTypeAsString(checker, type) ?? '';
      const complexName = TransformUtil.getSymbol(type)?.getName() ?? '';

      if (name in GLOBAL_SIMPLE) {
        const cons = GLOBAL_SIMPLE[name];
        const ret = TransformUtil.isLiteralType(type) ? Util.coerceType(type.value, cons as typeof String, false) :
          undefined;

        return {
          key: 'literal',
          ctor: cons,
          name: SIMPLE_NAMES[cons.name] ?? cons.name,
          value: ret
        };
      } else if (complexName in GLOBAL_COMPLEX) {
        const cons = GLOBAL_COMPLEX[complexName];
        return {
          key: 'literal',
          name: cons.name,
          ctor: cons,
          tsTypeArguments: TransformUtil.getAllTypeArguments(checker, type)
        };
      }
    }
  },
  external: {
    build: (checker, type) => {
      const source = TransformUtil.findSource(type)!;
      const comments = TransformUtil.describeDocs(type);
      const name = TransformUtil.getSymbol(type)?.getName();

      const obj: AnyType = { key: 'external', name, source: source.fileName, comment: comments.description };
      obj.tsTypeArguments = TransformUtil.getAllTypeArguments(checker, type);
      return obj;
    }
  },
  union: {
    build: (checker, type) => {
      const uType = type as ts.UnionType;
      const undefinable = uType.types.some(x => (x.getFlags() & ts.TypeFlags.Undefined));
      const nullable = uType.types.some(x => x.getFlags() & ts.TypeFlags.Null);
      const remainder = uType.types.filter(x => !(x.getFlags() & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
      const name = TransformUtil.getSymbol(type)?.getName();
      return { key: 'union', name, undefinable, nullable, tsUnionTypes: remainder, subTypes: [] };
    },
    finalize: (type: UnionType) => {
      const { undefinable, nullable, subTypes } = type;
      const [first] = subTypes;

      if (subTypes.length === 1) {
        return { undefinable, nullable, ...first };
      } else if (first.key === 'literal' && subTypes.every(el => el.name === first.name)) { // We have a common
        type.commonType = first;
      }
      return type;
    }
  },
  shape: {
    build: (checker, type, alias?) => {
      const docs = TransformUtil.describeDocs(type);
      const fieldNodes: Record<string, ts.Type> = {};
      const name = TransformUtil.getSymbol(alias ?? type);
      for (const member of checker.getPropertiesOfType(type)) {
        const memberType = checker.getTypeAtLocation(
          TransformUtil.getPrimaryDeclarationNode(member)
        );
        if (memberType.getCallSignatures().length) {
          continue;
        }
        fieldNodes[member.getName()] = memberType;
      }
      return {
        key: 'shape', name: name?.getName(),
        comment: docs.description,
        tsFieldTypes: fieldNodes,
        tsTypeArguments: TransformUtil.getAllTypeArguments(checker, type),
        fields: {}
      };
    }
  },
  concrete: {
    build: (checker, type) => {
      const tags = TransformUtil.readDocTag(type, 'concrete');
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
  }
};