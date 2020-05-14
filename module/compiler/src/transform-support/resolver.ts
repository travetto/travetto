import * as ts from 'typescript';
import { Util } from '@travetto/base';

import * as res from './types/resolver';
import { TransformUtil } from './util';

/**
 * List of global types that are simple
 */
const GLOBAL_SIMPLE = {
  RegExp, Date, Number, Boolean, String, Function, Object, Error,
  PromiseConstructor: Promise.constructor
};

function isLiteralType(type: ts.Type): type is ts.LiteralType {
  const flags = type.getFlags();
  // eslint-disable-next-line no-bitwise
  return (flags & (ts.TypeFlags.BooleanLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.StringLiteral)) > 0;
}

export const ITERATOR = function Iterator() { };
export const ASYNC_ITERATOR = function AsyncIterator() { };
export const ITERABLE_ITERATOR = function IterableIterator() { };
export const ITERABLE = function Iterable() { };

/**
 * List of global types that can be parameterized
 */
const GLOBAL_COMPLEX = {
  Array, Promise, Set, Map, ReadonlyArray: Array,
  Iterator: ITERATOR,
  Iterable: ITERABLE,
  IterableIterator: ITERABLE_ITERATOR,
  AsyncIterator: ASYNC_ITERATOR,
  PropertyDescriptor: Object,
  TypedPropertyDescriptor: Object
};

/**
 * Simple name mapping between JS type and typescript name
 */
const SIMPLE_NAMES: Record<string, string> = { String: 'string', Number: 'number', Boolean: 'boolean', Object: 'object' };

/**
 * Catch all type when dealing with unknown
 */
const UNKNOWN_TYPE = {
  ctor: Object,
  name: 'object'
} as res.LiteralType;

// FIXME: Provide support for recursive types and resolution
/**
 * Type resolver
 */
export class TypeResolver {
  /* eslint-disable no-bitwise */

  constructor(private tsChecker: ts.TypeChecker) { }

  /**
   * Resolve the `ts.ObjectFlags`
   */
  private getObjectFlags(type: ts.Type): ts.ObjectFlags {
    // @ts-ignore
    return ts.getObjectFlags(type);
  }

  /**
   * Fetch all type arguments for a give type
   */
  private getAllTypeArguments(ref: ts.Type): readonly ts.Type[] {
    // @ts-ignore
    return this.tsChecker.getTypeArguments(ref);
  }

  /**
   * Resolve `res.LiteralType` from a `ts.Type`
   */
  private resolveLiteralType(type: ts.Type): res.LiteralType | undefined {
    const flags = type.getFlags();

    // Handle void/undefined
    if (flags & ts.TypeFlags.Void) {
      return { name: 'void', ctor: undefined };
    } else if (flags & ts.TypeFlags.Undefined) {
      return { name: 'undefined', ctor: undefined };
    }

    const name = this.tsChecker.typeToString(this.tsChecker.getApparentType(type)) ?? '';
    const complexName = TransformUtil.getSymbolName(type);

    const simpleCons = GLOBAL_SIMPLE[name as keyof typeof GLOBAL_SIMPLE];
    const complexCons = GLOBAL_COMPLEX[complexName as keyof typeof GLOBAL_COMPLEX];

    // If the literal is a simple type
    if (simpleCons) {
      // Determine type from literal value
      const ret = isLiteralType(type) ? Util.coerceType(type.value, simpleCons as typeof String, false) :
        undefined;

      return {
        name: SIMPLE_NAMES[simpleCons.name] ?? simpleCons.name,
        ctor: simpleCons,
        value: ret
      };
    } else if (complexCons) {
      // Else handle complexity and resolve type arguments
      console.debug('Complex cons', complexCons.name, this.getAllTypeArguments(type));
      return {
        name: complexCons.name,
        ctor: complexCons,
        typeArguments: this.getAllTypeArguments(type).map(t => this.resolveType(t))
      };
    }
  }

  /**
   * Resolve `res.ShapeType` from `ts.Type`
   */
  private resolveShapeType(type: ts.Type, alias?: ts.Symbol): res.ShapeType {
    const docs = TransformUtil.readJSDocs(type);
    const fields: Record<string, res.Type> = {};
    const name = TransformUtil.getSymbolName(alias ?? type);
    for (const member of this.tsChecker.getPropertiesOfType(type)) {
      const memberType = this.tsChecker.getTypeAtLocation(
        this.getPrimaryDeclaration(member)
      );
      if (memberType.getCallSignatures().length) {
        continue;
      }
      fields[member.getName()] = this.resolveType(memberType);
    }
    return { name, comment: docs.description, fields };
  }

  /**
   * Resolve `res.ExternalType` from `ts.Type`
   */
  private resolveExternalType(type: ts.Type): res.ExternalType {
    const decl = this.getPrimaryDeclaration(type);
    const source = decl?.getSourceFile().fileName!;
    const name = TransformUtil.getSymbolName(type);
    const comments = TransformUtil.readJSDocs(type);

    return { name, source, comment: comments.description };
  }

  /**
   * Resolve `res.TupleType` from a `ts.Type`
   */
  private resolveTupleType(type: ts.Type): res.TupleType {
    const ret = {
      tupleTypes: this.getAllTypeArguments(type).map(x => this.resolveType(x))
    };
    console.debug('Tuple Type?', ret);
    return ret;
  }

  /**
   * Resolve a referenced `res.Type` from a `ts.Type`
   */
  private resolveReferencedType(type: ts.Type) {
    const obj = this.resolveExternalType(type);

    console.debug('External Type?', obj, type);

    // Handle target types
    if ('target' in type && type['target']) {
      type = type['target'] as ts.Type;
    }

    if (type.isClass()) { // Real type
      return obj;
    } else if (obj.source.includes('typescript/lib')) { // Global Type
      const ret = this.resolveLiteralType(type);
      if (ret) {
        return ret;
      }
    }

    if (obj.source.includes('typescript/lib')) {
      return { ...UNKNOWN_TYPE };
    }

    return this.resolveShapeType(type); // Handle fall through on interfaces
  }

  /**
   * Resolve `res.Type` from a `ts.UnionType`
   */
  private resolveUnionType(type: ts.UnionType): res.Type {
    const types = type.types;
    const undefinable = types.some(x => (x.getFlags() & ts.TypeFlags.Undefined));
    const nullable = types.some(x => x.getFlags() & ts.TypeFlags.Null);
    const remainderTypes = types.filter(x => !(x.getFlags() & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    const unionTypes = remainderTypes.map(x => this.resolveType(x));

    if (unionTypes.length > 1) {
      let common: res.LiteralType | undefined;
      const first = unionTypes[0];
      if (res.isLiteralType(first) && unionTypes.every(el => el.name === first.name)) { // We have a common
        common = {
          ctor: first.ctor,
          name: first.name
        };
      }
      if (common?.ctor === Boolean) {
        return this.resolveLiteralType(remainderTypes[0])!;
      } else {
        const remainder = {
          name: TransformUtil.getSymbolName(type),
          undefinable, nullable, commonType: common, unionTypes
        } as res.UnionType;
        console.debug('Union Type', remainder);
        return remainder;
      }
    }

    return {
      undefinable,
      nullable,
      ...this.resolveType(remainderTypes[0], type.aliasSymbol)
    };
  }

  /**
   * Resolve the return type for a method
   */
  getReturnType(node: ts.MethodDeclaration) {
    let type = this.tsChecker.getTypeAtLocation(node);
    if (type.isUnion()) { // Handle methods that are optional
      type = type.types.find(x => !(x.flags & ts.TypeFlags.Undefined))!;
    }
    const [sig] = type.getCallSignatures();
    return this.tsChecker.getReturnTypeOfSignature(sig);
  }

  /**
   * Read JS Doc tags by name
   */
  readDocsTags(node: ts.Node, name: string): string[] {
    return TransformUtil.readJSDocTags(this.tsChecker.getTypeAtLocation(node), name);
  }

  /**
   * Resolve a `res.Type` from a `ts.Type` or a `ts.Node`
   */
  resolveType(type: ts.Type | ts.Node, alias?: ts.Symbol): res.Type {
    if ('getSourceFile' in type) {
      type = this.tsChecker.getTypeAtLocation(type);
    }

    const concreteType = TransformUtil.resolveConcreteType(type);
    if (concreteType) {
      return concreteType;
    }

    const flags = type.getFlags();
    const objectFlags = this.getObjectFlags(type) ?? 0;

    if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { // Any or unknown
      return { ...UNKNOWN_TYPE };
    } else if (objectFlags & ts.ObjectFlags.Reference && !TransformUtil.getSymbol(type)) { // Tuple type?
      console.debug('Resolved Tuple Type', type);
      return this.resolveTupleType(type);
    } else if (objectFlags & ts.ObjectFlags.Anonymous) {
      console.debug('Resolved Shape Type', type);
      return this.resolveShapeType(type);
    } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
      console.debug('Resolved Reference Type', type);
      const v = this.resolveReferencedType(type);
      if (res.isLiteralType(v) && v.typeArguments) {
        v.typeArguments = this.getAllTypeArguments(type).map((x: any) => this.resolveType(x));
      }
      return v;
    } else if (flags & (
      ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral |
      ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.String | ts.TypeFlags.StringLiteral |
      ts.TypeFlags.Void | ts.TypeFlags.Undefined
    )) {
      console.debug('Resolved Literal Type', type);
      const result = this.resolveLiteralType(type);
      if (result) {
        return result;
      }
    } else if (type.isUnion()) {
      console.debug('Resolved Union Type', type);
      return this.resolveUnionType(type);
    } else if (objectFlags & ts.ObjectFlags.Tuple) {
      console.debug('Resolved Tuple Type', type);
      return this.resolveTupleType(type);
    } else if (type.isLiteral()) {
      console.debug('Resolved Shape Type', type);
      return this.resolveShapeType(type, alias);
    }

    console.debug('Resolved Unknown Type', type);
    return { ...UNKNOWN_TYPE };
  }

  /**
   * Get all declarations of a node
   */
  getDeclarations(node: ts.Node | ts.Type | ts.Symbol): ts.Declaration[] {
    return TransformUtil.getDeclarations('getSourceFile' in node ? this.tsChecker.getTypeAtLocation(node) : node);
  }

  /**
   * Get primary declaration of a node
   */
  getPrimaryDeclaration(node: ts.Node | ts.Symbol | ts.Type): ts.Declaration {
    return TransformUtil.getPrimaryDeclaration(this.getDeclarations(node));
  }
}