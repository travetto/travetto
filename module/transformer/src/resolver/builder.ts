/* eslint-disable no-bitwise */
import ts from 'typescript';

import { path, ManifestModuleUtil } from '@travetto/manifest';

import { DocUtil } from '../util/doc';
import { CoreUtil } from '../util/core';
import { DeclarationUtil } from '../util/declaration';
import { LiteralUtil } from '../util/literal';
import { transformCast, TemplateLiteralPart } from '../types/shared';

import { Type, AnyType, CompositionType, TransformResolver, TemplateType } from './types';
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

type Category =
  'void' | 'undefined' | 'concrete' | 'unknown' |
  'tuple' | 'shape' | 'literal' | 'template' | 'managed' |
  'composition' | 'foreign';

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
  } else if (DocUtil.hasDocTag(type, 'concrete')) {
    return { category: 'concrete', type };
  } else if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) { // Any or unknown
    return { category: 'unknown', type };
  } else if (objectFlags & ts.ObjectFlags.Reference && !CoreUtil.getSymbol(type)) { // Tuple type?
    return { category: 'tuple', type };
  } else if (objectFlags & ts.ObjectFlags.Anonymous) {
    try {
      const source = DeclarationUtil.getPrimaryDeclarationNode(type).getSourceFile();
      const sourceFile = source.fileName;
      if (sourceFile && ManifestModuleUtil.TYPINGS_EXT_RE.test(sourceFile) && !resolver.isKnownFile(sourceFile)) {
        return { category: 'foreign', type };
      }
    } catch { }
    return { category: 'shape', type };
  } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
    let resolvedType = type;
    if (CoreUtil.hasTarget(resolvedType)) {
      resolvedType = resolvedType.target;
      // If resolved target has a concrete type
      if (DocUtil.hasDocTag(resolvedType, 'concrete')) {
        return { category: 'concrete', type: resolvedType };
      }
    }

    const source = DeclarationUtil.getPrimaryDeclarationNode(resolvedType).getSourceFile();
    const sourceFile = source.fileName;
    if (sourceFile?.includes('typescript/lib')) {
      return { category: 'literal', type };
    } else if (sourceFile && ManifestModuleUtil.TYPINGS_EXT_RE.test(sourceFile) && !resolver.isKnownFile(sourceFile)) {
      return { category: 'foreign', type: resolvedType };
    } else if (!resolvedType.isClass()) { // Not a real type
      return { category: 'shape', type: resolvedType };
    } else {
      return { category: 'managed', type: resolvedType };
    }
  } else if (flags & (ts.TypeFlags.TemplateLiteral)) {
    return { category: 'template', type };
  } else if (flags & (
    ts.TypeFlags.BigIntLike |
    ts.TypeFlags.BooleanLike |
    ts.TypeFlags.NumberLike |
    ts.TypeFlags.StringLike |
    ts.TypeFlags.Void | ts.TypeFlags.Undefined
  )) {
    return { category: 'literal', type };
  } else if (type.isUnionOrIntersection()) {
    return { category: 'composition', type };
  } else if (objectFlags & ts.ObjectFlags.Tuple) {
    return { category: 'tuple', type };
  } else if (type.isLiteral()) {
    return { category: 'shape', type };
  } else if ((objectFlags & ts.ObjectFlags.Mapped)) { // Mapped types: Pick, Omit, Exclude, Retain
    if (type.getProperties().some(x => x.declarations || x.valueDeclaration)) {
      return { category: 'shape', type };
    }
  }
  return { category: 'literal', type };
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
    build: (resolver, type) => ({ key: 'unknown' })
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
  template: {
    build: (resolver, type) => {
      // If we are have a template literal type, we need to make our own type node
      if (type.flags & ts.TypeFlags.TemplateLiteral) {
        const values: TemplateLiteralPart[] = [];
        const texts = 'texts' in type && (typeof type.texts === 'object') && Array.isArray(type.texts) ? type.texts : undefined;
        const types = 'types' in type && (typeof type.types === 'object') && Array.isArray(type.types) ? type.types : undefined;
        if (texts?.length && types?.length) {
          for (let i = 0; i < texts?.length; i += 1) {
            if (texts[i] && texts[i] !== 'undefined') {
              values.push(texts[i]);
            }
            if (types[i]) {
              switch (types[i].intrinsicName) {
                case 'number': values.push(Number); break;
                case 'string': values.push(String); break;
                case 'boolean': values.push(Boolean); break;
                case 'undefined': values.push(''); break;
              }
            }
          }
          if (values.length > 0) {
            return ({ key: 'template', template: { op: 'and', values }, ctor: String });
          }
        }
      }
      return { key: 'literal', ctor: Object };
    }
  },
  literal: {
    build: (resolver, type) => {
      // Handle void/undefined
      const name = resolver.getTypeAsString(type) ?? '';
      const complexName = CoreUtil.getSymbol(type)?.getName() ?? '';

      if (name in GLOBAL_SIMPLE) {
        const cons = GLOBAL_SIMPLE[name];
        const ret = LiteralUtil.isLiteralType(type) ? CoerceUtil.coerce(type.value, transformCast(cons), false) :
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
      } else {
        return {
          key: 'literal',
          name: 'Object',
          ctor: Object
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
  composition: {
    build: (resolver, uType: ts.UnionOrIntersectionType) => {
      let undefinable = false;
      let nullable = false;
      const remainder = uType.types.filter(ut => {
        const u = (ut.getFlags() & (ts.TypeFlags.Undefined)) > 0;
        const n = (ut.getFlags() & (ts.TypeFlags.Null)) > 0;
        undefinable ||= u;
        nullable ||= n;
        return !(u || n);
      });
      const name = CoreUtil.getSymbol(uType)?.getName();
      return { key: 'composition', name, undefinable, nullable, tsSubTypes: remainder, subTypes: [], operation: uType.isUnion() ? 'or' : 'and' };
    },
    finalize: (type: CompositionType) => {
      const { undefinable, nullable, subTypes } = type;
      const [first] = subTypes;

      if (first.key === 'template') {
        return {
          key: 'template',
          ctor: String,
          nullable: type.nullable,
          undefinable: type.undefinable,
          template: { op: 'or', values: subTypes.map(x => transformCast<TemplateType>(x).template!) }
        };
      } else if (subTypes.length === 1) {
        return { undefinable, nullable, ...first };
      } else if (first.key === 'literal' && subTypes.every(el => el.name === first.name)) { // We have a common
        type.commonType = first;
      } else if (type.operation === 'and' && first.key === 'shape' && subTypes.every(el => el.key === 'shape')) { // All shapes
        return { importName: first.importName, name: first.name, key: 'shape', fieldTypes: subTypes.reduce((acc, x) => ({ ...acc, ...x.fieldTypes }), {}) };
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
        return { key: 'literal', name: 'Object', ctor: Object, importName };
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
      if (!DocUtil.hasDocTag(type, 'concrete')) {
        return;
      }

      const [tag] = DocUtil.readDocTag(type, 'concrete');
      let [importName, name] = tag?.split('#') ?? [];

      // Resolving relative to source file
      if (!importName || importName.startsWith('.')) {
        const rawSourceFile: string = DeclarationUtil.getDeclarations(type)
          ?.find(x => ts.getAllJSDocTags(x, (t): t is ts.JSDocTag => t.tagName.getText() === 'concrete').length)
          ?.getSourceFile().fileName ?? '';

        if (!importName || importName === '.') {
          importName = resolver.getFileImportName(rawSourceFile);
        } else {
          const base = path.dirname(rawSourceFile);
          importName = resolver.getFileImportName(path.resolve(base, importName));
        }
      }

      // Convert name to $Concrete suffix if not provided
      if (!name) {
        const [decl] = DeclarationUtil.getDeclarations(type).filter(x => ts.isInterfaceDeclaration(x) || ts.isTypeAliasDeclaration(x));
        name = `${decl.name.text}$Concrete`;
      }

      return { key: 'managed', name, importName };
    }
  }
};