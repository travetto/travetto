import * as ts from 'typescript';
import { Util } from '@travetto/base';

import * as res from './types/resolver';
import { TransformUtil } from './util';

const GLOBAL_SIMPLE = { RegExp, Date, Number, Boolean, String, Function, Object };
const GLOBAL_COMPLEX = { Array, Promise, Set, Map };
const SIMPLE_NAMES: Record<string, string> = { String: 'string', Number: 'number', Boolean: 'boolean', Object: 'object' };

export class TypeResolver {
  /* eslint-disable no-bitwise */

  constructor(private _checker: ts.TypeChecker) { }

  private getObjectFlags(type: ts.Type): ts.ObjectFlags {
    return (ts as any).getObjectFlags(type);
  }

  private getAllTypeArguments(ref: ts.Type) {
    return this._checker.getTypeArguments(ref as any);
  }

  private resolveRealType(type: ts.Type): res.RealType | undefined {
    const flags = type.getFlags();

    if (flags & ts.TypeFlags.Void) {
      return { name: 'void', realType: undefined };
    } else if (flags & ts.TypeFlags.Undefined) {
      return { name: 'undefined', realType: undefined };
    }

    const name = this._checker.typeToString(this._checker.getApparentType(type)) ?? '';
    const complexName = type.symbol?.getName();

    const simpleCons = GLOBAL_SIMPLE[name as keyof typeof GLOBAL_SIMPLE];
    const complexCons = GLOBAL_COMPLEX[complexName as keyof typeof GLOBAL_COMPLEX];
    if (simpleCons) {
      const ret = flags & (ts.TypeFlags.BooleanLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.StringLiteral) ?
        Util.coerceType((type as any).value, simpleCons as typeof String, false) :
        undefined;

      return {
        name: SIMPLE_NAMES[simpleCons.name] ?? simpleCons.name,
        realType: simpleCons,
        value: ret
      };
    } else if (complexCons) {
      return {
        name: complexCons.name,
        realType: complexCons,
        typeArguments: this.getAllTypeArguments(type).map(t => this.resolveType(t))
      };
    }
  }

  private resolveShapeType(type: ts.Type): res.ShapeType {
    const docs = TransformUtil.readJSDocs(type);
    const fields: Record<string, res.Type> = {};
    for (const member of this._checker.getPropertiesOfType(type)) {
      const memberType = this._checker.getTypeAtLocation(member.getDeclarations()![0]);
      if (memberType.getCallSignatures().length) {
        continue;
      }
      fields[member.getName()] = this.resolveType(memberType);
    }
    return { comment: docs.description, fields };
  }

  private resolveExternalType(type: ts.Type): res.ExternalType {
    const sym = type.symbol;
    const decl = sym.declarations?.[0];
    const source = decl?.getSourceFile().fileName;
    const name = sym?.getName();
    const comments = TransformUtil.readJSDocs(type);

    return { name, source, comment: comments.description };
  }

  private resolveTupleType(type: ts.Type): res.TupleType {
    return {
      tupleTypes: this.getAllTypeArguments(type).map(x => this.resolveType(x))
    };
  }

  private resolveReferencedType(type: ts.Type) {
    const obj = this.resolveExternalType(type);

    if (type.isClass()) { // Real type
      return obj;
    } else if (obj.source.includes('typescript/lib')) { // Global Type
      const ret = this.resolveRealType(type);
      if (ret) {
        return ret;
      }
    }

    return this.resolveShapeType(type); // Handle fall through on interfaces
  }

  private resolveUnionType(type: ts.UnionType): res.Type {
    const types = type.types;
    const unionTypes = types.map(x => this.resolveType(x));
    const undefinable = types.findIndex(x => x.flags & ts.TypeFlags.Undefined) >= 0;
    const nullable = types.findIndex(x => x.flags & ts.TypeFlags.Null) >= 0;
    const remainderTypes = types.filter(x => !(x.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));

    if (remainderTypes.length > 1) {
      let common = unionTypes.reduce((acc, v) => (!acc || acc.name === v.name) ? v : undefined, undefined as any);
      if (common) {
        common = {
          realType: common.realType,
          name: common.name
        };
      }
      return { undefinable, nullable, commonType: common, unionTypes } as res.UnionType;
    } else {
      return {
        undefinable,
        nullable,
        ...this.resolveType(remainderTypes[0])
      };
    }
  }

  getReturnType(node: ts.MethodDeclaration) {
    const [sig] = this._checker.getTypeAtLocation(node).getCallSignatures();
    return this._checker.getReturnTypeOfSignature(sig);
  }

  readDocsTags(node: ts.Node, name: string): string[] {
    const type = this._checker.getTypeAtLocation(node);
    const tags = type.symbol?.getJsDocTags() ?? [];
    return tags
      .filter(el => el.name === name)
      .map(el => el.text!);
  }

  resolveType(type: ts.Type | ts.Node): res.Type {
    if ('getSourceFile' in type) {
      type = this._checker.getTypeAtLocation(type);
    }
    const flags = type.getFlags();
    const objectFlags = this.getObjectFlags(type) ?? 0;

    console.log('Resolving type', objectFlags, flags, type);

    if (objectFlags & ts.ObjectFlags.Reference && !type.getSymbol()) { // Tuple type?
      return this.resolveTupleType(type);
    } else if (objectFlags & ts.ObjectFlags.Anonymous) {
      return this.resolveShapeType(type);
    } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
      return this.resolveReferencedType(type);
    } else if (flags & (
      ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral |
      ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.String | ts.TypeFlags.StringLiteral |
      ts.TypeFlags.Void | ts.TypeFlags.Undefined
    )) {
      const result = this.resolveRealType(type);
      if (result) {
        return result;
      }
    } else if (type.isUnion()) {
      return this.resolveUnionType(type);
    } else if (objectFlags & ts.ObjectFlags.Tuple) {
      return this.resolveTupleType(type);
    } else if (type.isLiteral()) {
      return this.resolveShapeType(type);
    }

    return {
      realType: Object,
      name: 'object'
    } as res.RealType;
  }

  getDeclarations(node: ts.Node): ts.Declaration[] {
    return this._checker.getTypeAtLocation(node).symbol?.getDeclarations() ?? [];
  }
}