/* eslint-disable no-bitwise */
import * as ts from 'typescript';
import { Util } from '@travetto/base';
import * as trv from './types';

export class TypeChecker {

  constructor(private _checker: ts.TypeChecker) { }

  getObjectFlags(type: ts.Type): ts.ObjectFlags {
    return (ts as any).getObjectFlags(type);
  }

  getAllTypeArguments(ref: ts.Type) {
    return this._checker.getTypeArguments(ref as any);
  }

  getReturnType(node: ts.MethodDeclaration) {
    const sig = this._checker.getTypeAtLocation(node).getCallSignatures()[0];
    return this._checker.getReturnTypeOfSignature(sig);
  }

  readJSDocs(type: ts.Type | ts.Node) {
    const node = 'getSourceFile' in type ? type : type.getSymbol()?.getDeclarations()?.[0];

    const out: trv.Documentation = {
      description: undefined,
      return: undefined,
      params: []
    };

    if (node) {
      const tags = ts.getJSDocTags(node);
      const docs = (node as any)['jsDoc'];

      if (docs) {
        const top = docs[docs.length - 1];
        if (ts.isJSDoc(top)) {
          out.description = top.comment;
        }
      }

      if (tags && tags.length) {
        for (const tag of tags) {
          if (ts.isJSDocReturnTag(tag)) {
            out.return = tag.comment;
          } else if (ts.isJSDocParameterTag(tag)) {
            out.params!.push({
              name: tag.name && tag.name.getText(),
              description: tag.comment ?? ''
            });
          }
        }
      }
    }
    return out;
  }

  getRealType(type: ts.Type): trv.RealType | undefined {
    const flags = type.getFlags();

    if (flags & ts.TypeFlags.Void) {
      return { name: 'void', realType: undefined };
    } else if (flags & ts.TypeFlags.Undefined) {
      return { name: 'undefined', realType: undefined };
    }

    const name = this._checker.typeToString(this._checker.getApparentType(type)) ?? '';
    const simpleCons = trv.GLOBAL_SIMPLE[name as keyof typeof trv.GLOBAL_SIMPLE];
    const complexCons = trv.GLOBAL_COMPLEX[name as keyof typeof trv.GLOBAL_COMPLEX];
    if (simpleCons) {
      const ret = flags & (ts.TypeFlags.BooleanLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.StringLiteral) ?
        Util.coerceType(this._checker.typeToString(type), simpleCons as typeof String, false) :
        undefined;

      return {
        realType: simpleCons,
        value: ret
      };
    } else if (complexCons) {
      return {
        realType: complexCons,
        typeArguments: this.getAllTypeArguments(type).map(t => this.resolveType(t))
      };
    }
  }

  getShapeType(type: ts.Type): trv.ShapeType {
    const docs = this.readJSDocs(type);
    const fields: Record<string, trv.Type> = {};
    for (const member of this._checker.getPropertiesOfType(type)) {
      const memberType = this._checker.getDeclaredTypeOfSymbol(member);
      if (!(memberType.getCallSignatures()?.length)) {
        fields[member.getName()] = this.resolveType(memberType);
      }
    }
    return { comment: docs.description, fields };
  }

  getExternalType(type: ts.Type): trv.ExternalType {
    const sym = type.symbol;
    const decl = sym.declarations?.[0];
    const source = decl?.getSourceFile().fileName;
    const name = sym?.getName();
    const comments = this.readJSDocs(type);

    return { name, source, comment: comments.description };
  }

  getUnionType(type: ts.UnionType): trv.UnionType {
    const types = type.types;
    const unionTypes = types.map(x => this.resolveType(x));
    let common = unionTypes.reduce((acc, v) => (!acc || acc.name === v.name) ? v : undefined, undefined as any);
    if (common) {
      common = { ...common };
      delete common.value;
    }
    const optional = types.findIndex(x => type.flags & ts.TypeFlags.Undefined) >= 0;

    return { optional, commonType: common, unionTypes };
  }

  getTupleType(type: ts.Type): trv.TupleType {
    return {
      tupleTypes: this.getAllTypeArguments(type).map(x => this.resolveType(x))
    };
  }

  resolveType(type: ts.Type | ts.Node): trv.Type {
    if ('getSourceFile' in type) {
      type = this._checker.getTypeAtLocation(type);
    }
    const flags = type.getFlags();
    const objectFlags = this.getObjectFlags(type) ?? 0;

    if (objectFlags & ts.ObjectFlags.Reference && !type.symbol) { // Tuple type?
      return this.getTupleType(type);
    } else if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
      const obj = this.getExternalType(type);

      if (type.isClass()) { // Real type
        return obj;
      } else if (obj.source.includes('typescript/lib')) { // Global Type
        const ret = this.getRealType(type);
        if (ret) {
          return ret;
        }
      }
      return this.getShapeType(type); // Handle fall through on interfaces
    } else if (flags & (
      ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral |
      ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.String | ts.TypeFlags.StringLiteral |
      ts.TypeFlags.Void | ts.TypeFlags.Undefined
    )) {
      const res = this.getRealType(type);
      if (res) {
        return res;
      }
    } else if (type.isUnion()) {
      return this.getUnionType(type);
    } else if (objectFlags & ts.ObjectFlags.Tuple) {
      return this.getTupleType(type);
    } else if (type.isLiteral()) {
      return this.getShapeType(type);
    }

    return {
      realType: Object,
      name: 'object'
    } as trv.RealType;
  }
}