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

  private resolveLiteralType(type: ts.Type): res.LiteralType | undefined {
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
      console.log('Complex cons', complexCons.name, this.getAllTypeArguments(type));
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

    console.info('External Type?', obj, type);

    if ('target' in type) {
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

    return this.resolveShapeType(type); // Handle fall through on interfaces
  }

  private resolveUnionType(type: ts.UnionType): res.Type {
    const types = type.types;
    const undefinable = types.some(x => (x.getFlags() & ts.TypeFlags.Undefined));
    const nullable = types.some(x => x.getFlags() & ts.TypeFlags.Null);
    const remainderTypes = types.filter(x => !(x.getFlags() & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    const unionTypes = remainderTypes.map(x => this.resolveType(x));

    if (unionTypes.length > 1) {
      let common = unionTypes.reduce((acc, v) => (!acc || acc.name === v.name) ? v : undefined, undefined as any);
      if (common) {
        common = {
          realType: common.realType,
          name: common.name
        };
      }
      if (common?.realType === Boolean) {
        return this.resolveLiteralType(remainderTypes[0])!;
      } else {
        return { undefinable, nullable, commonType: common, unionTypes } as res.UnionType;
      }
    }

    return {
      undefinable,
      nullable,
      ...this.resolveType(remainderTypes[0])
    };
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

    if (objectFlags & ts.ObjectFlags.Reference && !type.getSymbol()) { // Tuple type?
      console.info('Resolved Tuple Type', type);
      return this.resolveTupleType(type);
    } else if (objectFlags & ts.ObjectFlags.Anonymous) {
      console.info('Resolved Shape Type', type);
      return this.resolveShapeType(type);
    } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
      console.info('Resolved Reference Type', type);
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
      console.info('Resolved Literal Type', type);
      const result = this.resolveLiteralType(type);
      if (result) {
        return result;
      }
    } else if (type.isUnion()) {
      console.info('Resolved Union Type', type);
      return this.resolveUnionType(type);
    } else if (objectFlags & ts.ObjectFlags.Tuple) {
      console.info('Resolved Tuple Type', type);
      return this.resolveTupleType(type);
    } else if (type.isLiteral()) {
      console.info('Resolved Shape Type', type);
      return this.resolveShapeType(type);
    }

    console.info('Resolved Unknown Type', type);
    return {
      realType: Object,
      name: 'object'
    } as res.LiteralType;
  }

  getDeclarations(node: ts.Node): ts.Declaration[] {
    return this._checker.getTypeAtLocation(node).symbol?.getDeclarations() ?? [];
  }
}