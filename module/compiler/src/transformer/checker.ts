import * as ts from 'typescript';
import { CompilerUtil } from '../util';
import { Documentation, Type, ExternalType, RealType, UnionType, TupleType, ShapeType } from './types';
import { Util } from '@travetto/base';

const GLOBAL_SIMPLE = {
  RegExp,
  Date,
  Number,
  Boolean,
  String
};

const GLOBAL_COMPLEX = {
  Array,
  Promise,
  Set,
  Map
};

export class TypeChecker {

  constructor(private checker: ts.TypeChecker) { }

  getObjectFlags(type: ts.Type): ts.ObjectFlags {
    return (ts as any).getObjectFlags(type);
  }

  getAllTypeArguments(ref: ts.Type) {
    return this.checker.getTypeArguments(ref as any);
  }

  getReturnType(node: ts.MethodDeclaration) {
    const sig = this.checker.getTypeAtLocation(node).getCallSignatures()[0];
    return this.checker.getReturnTypeOfSignature(sig);
  }

  readJSDocs(type: ts.Type) {
    const node = type.getSymbol()?.getDeclarations()![0];
    const tags = ts.getJSDocTags(node);
    const docs = (node as any)['jsDoc'];

    const out: Documentation = {
      description: undefined,
      return: undefined,
      params: []
    };

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

    return out;
  }

  getRealType(type: ts.Type): RealType | undefined {
    /* eslint-disable no-bitwise */
    const flags = type.getFlags();

    if (flags & ts.TypeFlags.Void) {
      return { name: 'void', realType: undefined };
    } else if (flags & ts.TypeFlags.Undefined) {
      return { name: 'undefined', realType: undefined };
    }

    const name = type.symbol?.getName() ?? '';
    const simpleCons = GLOBAL_SIMPLE[name as keyof typeof GLOBAL_SIMPLE];
    const complexCons = GLOBAL_COMPLEX[name as keyof typeof GLOBAL_COMPLEX];
    if (simpleCons) {
      const ret = Util.coerceType(this.checker.typeToString(type), simpleCons as typeof String);
      return {
        realType: simpleCons,
        value: ret
      };
    } else if (complexCons) {
      return {
        realType: complexCons,
        typeArguments: this.getAllTypeArguments(type).map(t => this.resolveType(t))
      } as RealType;
    }
    /* eslint-enable no-bitwise */
  }

  getShapeType(type: ts.Type): ShapeType {
    const fields: Record<string, Type> = {};
    for (const member of this.checker.getPropertiesOfType(type)) {
      const memberType = this.checker.getDeclaredTypeOfSymbol(member);
      if (!(memberType.getCallSignatures()?.length)) {
        fields[member.getName()] = this.resolveType(memberType);
      }
    }
    return { fields };
  }

  getExternalType(type: ts.Type): ExternalType {
    const sym = type.symbol;
    const decl = sym.declarations?.[0];
    const fileName = decl?.getSourceFile().fileName;
    const name = sym?.getName();
    const comments = this.readJSDocs(type);

    return {
      source: fileName,
      comment: comments.description,
      name
    };
  }

  resolveType(type: ts.Type | ts.Node): Type {
    if ('getSourceFile' in type) {
      type = this.checker.getTypeAtLocation(type);
    }
    /* eslint-disable no-bitwise */
    const flags = type.getFlags();
    const objectFlags = this.getObjectFlags(type) ?? 0;

    if (objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
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
      const types = type.types;
      return {
        optional: types.find(x => (flags & ts.TypeFlags.Undefined) > 0),
        unionTypes: types.map(x => this.resolveType(x))
      } as UnionType;
    } else if (objectFlags & ts.ObjectFlags.Tuple) {
      return {
        tupleTypes: this.getAllTypeArguments(type).map(t => this.resolveType(t))
      } as TupleType;
    } else if (type.isLiteral()) {
      return this.getShapeType(type);
    }

    return {
      realType: Object,
      name: 'object'
    } as RealType;
    /* eslint-enable no-bitwise */
  }
}