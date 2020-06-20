/* eslint-disable no-bitwise */
import * as ts from 'typescript';
import { dirname } from 'path';

import { FsUtil } from '@travetto/boot';
import { Util } from '@travetto/base';

import { Type, AnyType, UnionType, Checker } from './types';
import { DocUtil, CoreUtil, DeclarationUtil, LiteralUtil } from '../util';

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
  const objectFlags = CoreUtil.getObjectFlags(type) ?? 0;

  if (flags & ts.TypeFlags.Void) {
    return { category: 'void', type };
  } else if (flags & ts.TypeFlags.Undefined) {
    return { category: 'undefined', type };
  } else if (DocUtil.readDocTag(type, 'concrete').length) {
    return { category: 'concrete', type };
  } else if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { // Any or unknown
    return { category: 'unknown', type };
  } else if (objectFlags & ts.ObjectFlags.Reference && !CoreUtil.getSymbol(type)) { // Tuple type?
    return { category: 'tuple', type };
  } else if (objectFlags & ts.ObjectFlags.Anonymous) {
    return { category: 'shape', type };
  } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
    let resolvedType = type;
    if ('target' in resolvedType && resolvedType['target']) {
      resolvedType = resolvedType['target'] as ts.Type;
    }
    console.log('Resolving here');

    if (!resolvedType.isClass()) { // Real type
      const source = DeclarationUtil.getPrimaryDeclarationNode(resolvedType).getSourceFile();
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
    build(checker: Checker, type: ts.Type, alias?: ts.Symbol): AnyType | undefined;
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
    build: (checker, type) => ({ key: 'tuple', tsTupleTypes: checker.getAllTypeArguments(type), subTypes: [] })
  },
  literal: {
    build: (checker, type) => {
      // Handle void/undefined
      const name = checker.getTypeAsString(type) ?? '';
      const complexName = CoreUtil.getSymbol(type)?.getName() ?? '';

      if (name in GLOBAL_SIMPLE) {
        const cons = GLOBAL_SIMPLE[name];
        const ret = LiteralUtil.isLiteralType(type) ? Util.coerceType(type.value, cons as typeof String, false) :
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
          tsTypeArguments: checker.getAllTypeArguments(type)
        };
      }
    }
  },
  external: {
    build: (checker, type) => {
      const source = DeclarationUtil.getPrimaryDeclarationNode(type).getSourceFile();
      const name = CoreUtil.getSymbol(type)?.getName();
      return {
        key: 'external', name, source: source.fileName,
        tsTypeArguments: checker.getAllTypeArguments(type)
      };
    }
  },
  union: {
    build: (checker, type) => {
      const uType = type as ts.UnionType;
      let undefinable = false;
      let nullable = false;
      const remainder = uType.types.filter(ut => {
        const u = (ut.getFlags() & (ts.TypeFlags.Undefined)) > 0;
        const n = (ut.getFlags() & (ts.TypeFlags.Null)) > 0;
        undefinable = undefinable || u;
        nullable = nullable || n;
        return !(u || n);
      });
      const name = CoreUtil.getSymbol(type)?.getName();
      return { key: 'union', name, undefinable, nullable, tsSubTypes: remainder, subTypes: [] };
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
      const fieldNodes: Record<string, ts.Type> = {};
      const name = CoreUtil.getSymbol(alias ?? type);
      const source = DeclarationUtil.getPrimaryDeclarationNode(type)?.getSourceFile();
      for (const member of checker.getPropertiesOfType(type)) {
        const memberType = checker.getType(
          DeclarationUtil.getPrimaryDeclarationNode(member)
        );
        if (memberType.getCallSignatures().length) {
          continue;
        }
        fieldNodes[member.getName()] = memberType;
      }
      return {
        key: 'shape', name: name?.getName(),
        source: source?.fileName,
        tsFieldTypes: fieldNodes,
        tsTypeArguments: checker.getAllTypeArguments(type),
        fieldTypes: {}
      };
    }
  },
  concrete: {
    build: (checker, type) => {
      const tags = DocUtil.readDocTag(type, 'concrete');
      if (tags.length) {
        const parts = tags[0].split(':');
        const fileName = DeclarationUtil.getPrimaryDeclarationNode(type)?.getSourceFile().fileName;
        if (parts.length === 1) {
          parts.unshift('.');
        }
        const source = parts[0] === '.' ? fileName : FsUtil.resolveUnix(dirname(fileName), parts[0]);
        return { key: 'external', name: parts[1], source };
      }
    }
  }
};