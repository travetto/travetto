/* eslint-disable no-bitwise */
import ts from 'typescript';

import { path } from '@travetto/manifest';

import { DocUtil } from '../util/doc';
import { CoreUtil } from '../util/core';
import { DeclarationUtil } from '../util/declaration';
import { LiteralUtil } from '../util/literal';

import { Type, AnyType, UnionType, TransformResolver } from './types';
import { CoerceUtil } from './coerce';

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

type Category = 'void' | 'undefined' | 'concrete' | 'unknown' | 'tuple' | 'shape' | 'literal' | 'managed' | 'union' | 'foreign';

/**
 * Type categorizer, input for builder
 */
export function TypeCategorize(resolver: TransformResolver, type: ts.Type): { category: Category, type: ts.Type } {
  const flags = type.getFlags();
  const objectFlags = DeclarationUtil.getObjectFlags(type) ?? 0;

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
    const source = DeclarationUtil.getPrimaryDeclarationNode(type).getSourceFile();
    const sourceFile = source.fileName;
    if (sourceFile?.endsWith('.d.ts') && !resolver.isKnownFile(sourceFile)) {
      return { category: 'foreign', type };
    } else {
      return { category: 'shape', type };
    }
  } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
    let resolvedType = type;
    if (CoreUtil.hasTarget(resolvedType)) {
      resolvedType = resolvedType.target;
      // If resolved target has a concrete type
      if (DocUtil.readDocTag(resolvedType, 'concrete').length) {
        return { category: 'concrete', type: resolvedType };
      }
    }

    const source = DeclarationUtil.getPrimaryDeclarationNode(resolvedType).getSourceFile();
    const sourceFile = source.fileName;
    if (sourceFile?.includes('typescript/lib')) {
      return { category: 'literal', type };
    } else if (sourceFile?.endsWith('.d.ts') && !resolver.isKnownFile(sourceFile)) {
      return { category: 'foreign', type: resolvedType };
    } else if (!resolvedType.isClass()) { // Not a real type
      return { category: 'shape', type: resolvedType };
    } else {
      return { category: 'managed', type: resolvedType };
    }
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
    build(resolver: TransformResolver, type: ts.Type, alias?: ts.Symbol): AnyType | undefined;
    finalize?(type: Type<K>): AnyType;
  }
} = {
  unknown: {
    build: (resolver, type) => undefined
  },
  undefined: {
    build: (resolver, type) => ({ key: 'literal', name: 'undefined', ctor: undefined })
  },
  void: {
    build: (resolver, type) => ({ key: 'literal', name: 'void', ctor: undefined })
  },
  tuple: {
    build: (resolver, type) => ({ key: 'tuple', tsTupleTypes: resolver.getAllTypeArguments(type), subTypes: [] })
  },
  literal: {
    build: (resolver, type) => {
      // Handle void/undefined
      const name = resolver.getTypeAsString(type) ?? '';
      const complexName = CoreUtil.getSymbol(type)?.getName() ?? '';

      if (name in GLOBAL_SIMPLE) {
        const cons = GLOBAL_SIMPLE[name];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const ret = LiteralUtil.isLiteralType(type) ? CoerceUtil.coerce(type.value, cons as typeof String, false) :
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
          tsTypeArguments: resolver.getAllTypeArguments(type)
        };
      }
    }
  },
  foreign: {
    build: (resolver, type) => {
      const name = CoreUtil.getSymbol(type)?.getName();
      const source = DeclarationUtil.getPrimaryDeclarationNode(type).getSourceFile();
      return { key: 'foreign', name, source: source.fileName };
    }
  },
  managed: {
    build: (resolver, type) => {
      const name = CoreUtil.getSymbol(type)?.getName();
      const importName = resolver.getTypeImportName(type)!;
      const tsTypeArguments = resolver.getAllTypeArguments(type);
      return { key: 'managed', name, importName, tsTypeArguments };
    }
  },
  union: {
    build: (resolver, uType: ts.UnionType) => {
      let undefinable = false;
      let nullable = false;
      const remainder = uType.types.filter(ut => {
        const u = (ut.getFlags() & (ts.TypeFlags.Undefined)) > 0;
        const n = (ut.getFlags() & (ts.TypeFlags.Null)) > 0;
        undefinable = undefinable || u;
        nullable = nullable || n;
        return !(u || n);
      });
      const name = CoreUtil.getSymbol(uType)?.getName();
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
    build: (resolver, type, alias?) => {
      const tsFieldTypes: Record<string, ts.Type> = {};
      const name = CoreUtil.getSymbol(alias ?? type)?.getName();
      const importName = resolver.getTypeImportName(type) ?? '<unknown>';
      const tsTypeArguments = resolver.getAllTypeArguments(type);
      const props = resolver.getPropertiesOfType(type);
      if (props.length === 0) {
        return { key: 'unknown', name, importName };
      }

      for (const member of props) {
        const dec = DeclarationUtil.getPrimaryDeclarationNode(member);
        if (DeclarationUtil.isPublic(dec)) { // If public
          const memberType = resolver.getType(dec);
          if (
            !member.getName().includes('@') && // if not a symbol
            !memberType.getCallSignatures().length // if not a function
          ) {
            tsFieldTypes[member.getName()] = memberType;
          }
        }
      }
      return { key: 'shape', name, importName, tsFieldTypes, tsTypeArguments, fieldTypes: {} };
    }
  },
  concrete: {
    build: (resolver, type) => {
      const [tag] = DocUtil.readDocTag(type, 'concrete');
      if (tag) {
        // eslint-disable-next-line prefer-const
        let [importName, name] = tag.split(':');
        if (!name) {
          name = importName;
          importName = '.';
        }

        // Resolving relative to source file
        if (importName.startsWith('.')) {
          const rawSourceFile: string = DeclarationUtil.getDeclarations(type)
            ?.find(x => ts.getAllJSDocTags(x, (t): t is ts.JSDocTag => t.tagName.getText() === 'concrete').length)
            ?.getSourceFile().fileName ?? '';

          if (importName === '.') {
            importName = resolver.getFileImportName(rawSourceFile);
          } else {
            const base = path.dirname(rawSourceFile);
            importName = resolver.getFileImportName(path.resolve(base, importName));
          }
        }
        return { key: 'managed', name, importName };
      }
    }
  }
};