/* eslint-disable no-bitwise */
import ts from 'typescript';

import { path, ManifestModuleUtil } from '@travetto/manifest';

import { DocUtil } from '../util/doc.ts';
import { CoreUtil } from '../util/core.ts';
import { DeclarationUtil } from '../util/declaration.ts';
import { LiteralUtil } from '../util/literal.ts';
import { transformCast, type TemplateLiteralPart } from '../types/shared.ts';

import type { Type, AnyType, CompositionType, TransformResolver, TemplateType, MappedType, ShapeType, ResolverContext, ManagedType } from './types.ts';
import { CoerceUtil } from './coerce.ts';

const UNDEFINED = Symbol();

const MAPPED_TYPE_SET = new Set(['Omit', 'Pick', 'Required', 'Partial']);
const allowsVirtualTemplate = (type: ts.Type): boolean => DocUtil.readDocTag(type, 'virtual')?.[0]?.trim() === 'true';
const isMappedType = (type: string | undefined): type is MappedType['operation'] => MAPPED_TYPE_SET.has(type!);
const getMappedFields = (type: ts.Type): string[] | undefined => {
  if (type.isStringLiteral()) {
    return [type.value];
  } else if (type.isUnion() && type.types.every(subType => subType.isStringLiteral())) {
    return type.types.map(subType => subType.value);
  }
};

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
const UNDEFINED_GLOBAL = { undefined: 1, void: 1, null: 1 };
const SIMPLE_NAMES: Record<string, string> = { String: 'string', Number: 'number', Boolean: 'boolean', Object: 'object' };
const GLOBAL_SIMPLE: Record<string, Function> = {
  RegExp, Date, Number, Boolean, String, Function, Object, Error, BigInt,
  ArrayBuffer, SharedArrayBuffer,
  Uint8Array, Uint16Array, Uint32Array,
  Int8Array, Int16Array, Int32Array,
  Uint8ClampedArray, BigInt64Array, BigUint64Array,
  Float16Array, Float32Array, Float64Array,
  PromiseConstructor: Promise.constructor
};

type Category = Exclude<AnyType['key'], 'pointer'> | 'concrete';

/**
 * Type categorizer, input for builder
 */
export function TypeCategorize(resolver: TransformResolver, type: ts.Type): { category: Category, type: ts.Type } {
  const flags = type.getFlags();
  const objectFlags = DeclarationUtil.getObjectFlags(type) ?? 0;

  if (flags & (ts.TypeFlags.TemplateLiteral)) {
    return { category: 'template', type };
  } else if (flags & (
    ts.TypeFlags.BigIntLike |
    ts.TypeFlags.BooleanLike |
    ts.TypeFlags.NumberLike |
    ts.TypeFlags.StringLike |
    ts.TypeFlags.Null |
    ts.TypeFlags.Undefined |
    ts.TypeFlags.Void
  )) {
    return { category: 'literal', type };
  } else if (DocUtil.hasDocTag(type, 'concrete')) {
    return { category: 'concrete', type };
  } else if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) { // Any or unknown
    return { category: 'unknown', type };
  } else if (objectFlags & ts.ObjectFlags.Reference && !CoreUtil.getSymbol(type)) { // Tuple type?
    return { category: 'tuple', type };
  } else if (type.isUnionOrIntersection()) {
    return { category: 'composition', type };
  } else if (objectFlags & ts.ObjectFlags.Anonymous) {
    try {
      const source = DeclarationUtil.getPrimaryDeclarationNode(type).getSourceFile();
      const sourceFile = source.fileName;
      if (sourceFile && ManifestModuleUtil.TYPINGS_EXT_REGEX.test(sourceFile) && !resolver.isKnownFile(sourceFile)) {
        return { category: 'foreign', type };
      }
    } catch { }

    const text = resolver.getTypeAsString(type);
    if (flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.ExportValue)
      && text?.startsWith('typeof')
    ) {
      return { category: 'managed', type };
    }
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
    } else if (sourceFile && ManifestModuleUtil.TYPINGS_EXT_REGEX.test(sourceFile) && !resolver.isKnownFile(sourceFile)) {
      return { category: 'foreign', type: resolvedType };
    } else if (!resolvedType.isClass()) { // Not a real type
      return { category: 'shape', type: resolvedType };
    } else {
      return { category: 'managed', type: resolvedType };
    }
  } else if (objectFlags & ts.ObjectFlags.Tuple) {
    return { category: 'tuple', type };
  } else if (type.isLiteral()) {
    return { category: 'shape', type };
  } else if (objectFlags & ts.ObjectFlags.Mapped) { // Mapped types
    if (type.getProperties().some(property => property.declarations || property.valueDeclaration)) {
      return { category: 'mapped', type };
    }
  }
  return { category: 'literal', type };
}

/**
 * Type builder
 */
export const TypeBuilder: {
  [K in Category]: {
    build(resolver: TransformResolver, type: ts.Type, context: ResolverContext): AnyType | undefined;
    finalize?(type: Type<K>): AnyType;
  }
} = {
  unknown: {
    build: (resolver, type) => {
      const optional = UNDEFINED in type;
      return { key: 'unknown', nullable: optional, undefinable: optional };
    }
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
            return ({ key: 'template', template: { operation: 'and', values }, ctor: String });
          }
        }
      }
      return { key: 'literal', ctor: Object };
    }
  },
  literal: {
    build: (resolver, type) => {
      // Handle void/undefined
      const name = (resolver.getTypeAsString(type) ?? '').split('<')[0]; // Ensure we strip off any type arguments for lookup
      const complexName = CoreUtil.getSymbol(type)?.getName() ?? '';

      if (name in UNDEFINED_GLOBAL) {
        return { key: 'literal', ctor: undefined, name };
      } else if (name in GLOBAL_SIMPLE) {
        const cons = GLOBAL_SIMPLE[name];
        const literal = LiteralUtil.isLiteralType(type) ? CoerceUtil.coerce(type.value, transformCast(cons), false) :
          undefined;

        return {
          key: 'literal',
          ctor: cons,
          name: SIMPLE_NAMES[cons.name] ?? cons.name,
          value: literal
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
      return { key: 'foreign', name, source: source.fileName, classId: `${source.fileName.split('node_modules/')[1]}+${name}` };
    }
  },
  managed: {
    build: (resolver, type, context) => {
      const name = CoreUtil.getSymbol(type)?.getName();
      const importName = resolver.getTypeImportName(type)!;
      const tsTypeArguments = resolver.getAllTypeArguments(type);
      const docs = DocUtil.readDocTag(type, 'see');
      const innerTypeProperty = docs.find(doc => doc.includes('#target'))?.split(' ')?.[0];

      const managedType: ManagedType = { key: 'managed', name, importName, tsTypeArguments, innerTypeProperty };

      // Detect managed, but shapeable
      if (tsTypeArguments.length > 0) {
        const hasEmptyConstructor = type.getConstructSignatures().some(signature => signature.parameters.length === 0)
          || type.getConstructSignatures().length === 0; // If no constructor, we can assume it's shapeable
        const hasMethods = type.getProperties().some(property => property.getFlags() & ts.SymbolFlags.Method);
        if (hasEmptyConstructor && !hasMethods && allowsVirtualTemplate(type)) {
          return TypeBuilder.shape.build(resolver, type, {
            ...context,
            extendsFrom: managedType,
            alias: type.aliasSymbol
          });
        }
      }

      return managedType;
    },
  },
  composition: {
    build: (resolver, uType: ts.UnionOrIntersectionType) => {
      let undefinable = false;
      let nullable = false;
      const remainder = uType.types.filter(ut => {
        const isUndefined = (ut.getFlags() & (ts.TypeFlags.Undefined)) > 0;
        const isNull = (ut.getFlags() & (ts.TypeFlags.Null)) > 0;
        undefinable ||= isUndefined;
        nullable ||= isNull;
        return !(isUndefined || isNull);
      });
      const name = CoreUtil.getSymbol(uType)?.getName();
      return { key: 'composition', name, undefinable, nullable, tsSubTypes: remainder, subTypes: [], operation: uType.isUnion() ? 'or' : 'and' };
    },
    finalize: (type: CompositionType) => {
      const { undefinable, nullable, subTypes } = type;

      if (subTypes.length === 0) { // We have an unknown type?
        return { key: 'unknown', nullable, undefinable };
      }

      const [first] = subTypes;

      if (first.key === 'template') {
        return {
          key: 'template',
          ctor: String,
          nullable: type.nullable,
          undefinable: type.undefinable,
          template: { operation: 'or', values: subTypes.map(subType => transformCast<TemplateType>(subType).template!) }
        };
      } else if (subTypes.length === 1) {
        return { undefinable, nullable, ...first };
      } else if (first.key === 'literal' && subTypes.every(item => item.name === first.name)) { // We have a common
        type.commonType = first;
      } else if (type.operation === 'and' && first.key === 'shape' && subTypes.every(item => item.key === 'shape')) { // All shapes
        return {
          importName: first.importName,
          name: first.name,
          key: 'shape',
          fieldTypes: subTypes.reduce((map, subType) => ({ ...map, ...subType.fieldTypes }), {})
        };
      }
      return type;
    }
  },
  mapped: {
    build: (resolver, type, context) => {
      let mainType: ts.Type | undefined;
      let fields: string[] | undefined;
      let operation: string | undefined;
      let name: string | undefined;

      const declarations = DeclarationUtil.getDeclarations(type).filter(declaration => ts.isTypeAliasDeclaration(declaration));
      const ref = declarations[0]?.type;

      if (ref && ts.isTypeReferenceNode(ref) && ref.typeArguments && ref.typeArguments.length > 0) {
        const [first, second] = ref.typeArguments;
        mainType = resolver.getType(first);
        operation = ref.typeName.getText();
        name = resolver.getTypeAsString(type)!;
        fields = !second ? [] : getMappedFields(resolver.getType(second));
      } else if (type.aliasTypeArguments && type.aliasSymbol) {
        mainType = type.aliasTypeArguments[0];
        operation = type.aliasSymbol.escapedName.toString();
        fields = (type.aliasTypeArguments.length > 1) ? getMappedFields(type.aliasTypeArguments[1]) : [];
        name = `${resolver.getTypeAsString(mainType)!}_${operation}_${fields?.join('_')}`;
      }

      if (!isMappedType(operation) || fields === undefined || !mainType || !mainType.isClass()) {
        return TypeBuilder.shape.build(resolver, type, context);
      }

      const importName = resolver.getTypeImportName(mainType) ?? '<unknown>';
      const mappedClassName = resolver.getTypeAsString(mainType)!;

      return { key: 'mapped', name, original: mainType, operation, importName, mappedClassName, fields };
    }
  },
  shape: {
    build: (resolver, type, context) => {
      const importName = resolver.getTypeImportName(type) ?? '<unknown>';
      const properties = resolver.getPropertiesOfType(type);
      if (properties.length === 0) {
        return { key: 'literal', name: 'Object', ctor: Object, importName };
      }

      const tsTypeArguments = resolver.getAllTypeArguments(type);
      const name = CoreUtil.getSymbol(context?.alias ?? type)?.getName();
      const tsFieldTypes: Record<string, ts.Type> = {};

      for (const member of properties) {
        const declaration = DeclarationUtil.getPrimaryDeclarationNode(member);
        if (DeclarationUtil.isPublic(declaration)) { // IF public
          const memberType = resolver.getType(declaration);
          if (
            !member.getName().includes('@') && // if not a symbol
            !memberType.getCallSignatures().length // if not a function
          ) {
            if ((ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) && !!declaration.questionToken) {
              Object.defineProperty(memberType, UNDEFINED, { value: true });
            }
            tsFieldTypes[member.getName()] = memberType;
          }
        }
      }
      return {
        key: 'shape', name, importName, tsFieldTypes, tsTypeArguments,
        fieldTypes: {}, extendsFrom: context.extendsFrom, canTemplate: allowsVirtualTemplate(type)
      };
    },
    finalize: (type: ShapeType) => {
      if ((type.typeArguments?.length ?? 0) > 0 && type.canTemplate !== false) {
        let suffix = '';
        const typeTemplateMap = Object.fromEntries(type.typeArguments!.map(node => [node.templateTypeName, node]));

        for (const field of Object.values(type.fieldTypes)) {
          if (field.key === 'literal' || field.key === 'shape' || field.key === 'managed') {
            if (field.typeArguments?.every(item => item.templateTypeName && item.templateTypeName in typeTemplateMap)) {
              field.typeArguments = field.typeArguments.map(item => typeTemplateMap[item.templateTypeName!]);
              suffix = `${suffix}${field.name}${field.typeArguments.map(arg => arg.name).join('$')}`;
            }
          }
        }
        if (suffix) {
          type.name = `${type.name}$${suffix}`;
        }
      }
      return type;
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
          ?.find(declaration => ts.getAllJSDocTags(declaration, (node): node is ts.JSDocTag => node.tagName.getText() === 'concrete').length)
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
        const [primaryDeclaration] = DeclarationUtil.getDeclarations(type)
          .filter(declaration => ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration));
        name = `${primaryDeclaration.name.text}$Concrete`;
      }

      return { key: 'managed', name, importName };
    }
  }
};
