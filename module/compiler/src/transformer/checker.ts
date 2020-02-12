import * as ts from 'typescript';
import { CompilerUtil } from '../util';
import { Documentation } from './types';

export class TypeChecker {

  constructor(
    private checker: ts.TypeChecker,
    private resolveReference: (type: ts.Type) => ts.Expression
  ) { }

  getObjectFlags(type: ts.Type): ts.ObjectFlags {
    return (ts as any).getObjectFlags(type);
  }

  shapeTypeToExpression(type: ts.Type): ts.Expression {
    const properties: ts.PropertyAssignment[] = [];
    for (const member of this.checker.getPropertiesOfType(type)) {
      const memberType = this.checker.getDeclaredTypeOfSymbol(member);
      properties.push(ts.createPropertyAssignment(ts.createIdentifier(member.getName()), this.typeToExpression(memberType)));
    }
    return ts.createObjectLiteral(properties);
  }

  getPrimaryTypeParameter(ref: ts.Type) {
    return this.checker.getTypeArguments(ref as any)[0];
  }

  isPromiseType(type: ts.Type) {
    /* eslint-disable no-bitwise */
    const objectFlags = this.getObjectFlags(type) ?? 0;
    if (objectFlags & ts.ObjectFlags.Reference) {
      if (type.symbol.getName() === 'Promise') {
        const fileName = type.symbol.declarations?.[0]?.getSourceFile().fileName;
        if (fileName.includes('node_modules/typescript/lib')) {
          return true;
        }
      }
    }
    return false;
    /* eslint-enable no-bitwise */
  }

  getReturnType(node: ts.MethodDeclaration) {
    const sig = this.checker.getTypeAtLocation(node).getCallSignatures()[0];
    return this.checker.getReturnTypeOfSignature(sig);
  }

  typeToExpression(type: ts.Type): ts.Expression {
    /* eslint-disable no-bitwise */
    let expr: ts.Expression | undefined;
    const flags = type.getFlags();
    const objectFlags = this.getObjectFlags(type) ?? 0;

    if (objectFlags & ts.ObjectFlags.Reference) {
      const fileName = type.symbol.declarations?.[0]?.getSourceFile().fileName;
      if (type.isClass()) { // Real type
        expr = this.resolveReference(type);
      } else { // Is interface
        if (fileName.includes('node_modules/typescript/lib')) { // Global Type
          const name = type.symbol.getName();
          if (name === 'Array') {
            expr = ts.createArrayLiteral([this.typeToExpression(this.getPrimaryTypeParameter(type))]);
          } else {
            expr = ts.createIdentifier(name);
          }
        } else { // Not global type
          // TODO: interface not a class
          // CompilerUtil.log('Interfaced value', type, fileName);
        }
      }
    } else if ((flags & ts.TypeFlags.StringLiteral) || (flags & ts.TypeFlags.String)) {
      expr = ts.createIdentifier('String');
    } else if ((flags & ts.TypeFlags.NumberLiteral) || (flags & ts.TypeFlags.Number)) {
      expr = ts.createIdentifier('Number');
    } else if ((flags & ts.TypeFlags.BooleanLiteral) || (flags & ts.TypeFlags.Boolean)) {
      expr = ts.createIdentifier('Boolean');
    } else if ((flags & ts.TypeFlags.Void) || (flags & ts.TypeFlags.Undefined)) {
      expr = ts.createIdentifier('undefined');
    } else if (type.isUnion()) {
      const types = type.types.filter(x => (flags & ts.TypeFlags.Undefined) === 0);
      expr = types.slice(1).reduce((fType, stype) => {
        const fTypeStr = (fType as any)['text']!;
        CompilerUtil.log(fTypeStr);
        if (fTypeStr !== 'Object') {
          const resolved = this.typeToExpression(stype);
          if ((resolved as any)['text'] !== fTypeStr) {
            fType = ts.createIdentifier('Object');
          }
        }
        return fType;
      }, this.typeToExpression(types[0]));

    } else if (objectFlags & ts.ObjectFlags.Tuple) {
      expr = ts.createArrayLiteral(type.aliasTypeArguments!.map(t => this.typeToExpression(t)));
    } else if (type.isLiteral()) {
      expr = this.shapeTypeToExpression(type);
    }

    if (!expr) {
      //  CompilerUtil.log('Unable to type', type);
    }
    return expr || ts.createIdentifier('Object');
    /* eslint-enable no-bitwise */
  }

  resolveType(node: ts.Node): ts.Expression { // Should get replaced with TypeChecker as needed
    return this.typeToExpression(this.checker.getTypeAtLocation(node));
  }

  describeByJSDocs(node: ts.Node) {
    while ('original' in node) {
      node = (node as any).original as ts.Node;
    }
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
          out.return = {
            type: tag.typeExpression && this.resolveType(tag.typeExpression.type),
            description: tag.comment
          };
        } else if (ts.isJSDocParameterTag(tag)) {
          out.params!.push({
            name: tag.name && tag.name.getText(),
            description: tag.comment ?? '',
            type: tag.typeExpression && this.resolveType(tag.typeExpression.type),
            required: !tag.isBracketed
          });
        }
      }
    }

    return out;
  }
}