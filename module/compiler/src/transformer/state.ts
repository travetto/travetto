import * as ts from 'typescript';
import { dirname } from 'path';

import { FsUtil, RegisterUtil } from '@travetto/boot';
import { SystemUtil, Env } from '@travetto/base';
import { TransformUtil } from './util';
import { Import, Documentation } from './types';
import { CompilerUtil } from '../util';

export class TransformerState {
  readonly path: string;
  readonly modulePath: string;

  readonly newImports = new Map<string, Import>();
  readonly decorators = new Map<string, ts.PropertyAccessExpression>();
  readonly imports = new Map<string, Import>();
  readonly ids = new Map<string, number>();

  constructor(public source: ts.SourceFile, public checker: ts.TypeChecker) {
    const pth = require.resolve(source.fileName);
    this.path = FsUtil.resolveNative(pth);
    this.modulePath = FsUtil.resolveUnix(pth);
    this.collectInitialImports();
  }

  generateUniqueId(name: string) {
    const val = (this.ids.get(name) ?? 0) + 1;
    this.ids.set(name, val);
    return ts.createIdentifier(`${name}_${val}`);
  }

  collectInitialImports() {
    for (const stmt of this.source.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        let path = TransformUtil.optionalResolve(stmt.moduleSpecifier.text
          .replace(/^\.\./, dirname(dirname(this.path)))
          .replace(/^\.\//, `${dirname(this.path)}/`));

        if (process.env.TRV_FRAMEWORK_DEV) {
          path = RegisterUtil.resolveFrameworkDevFile(path);
        }

        const pkg = TransformUtil.extractPackage(path);

        if (stmt.importClause) {
          if (stmt.importClause.namedBindings) {
            const bindings = stmt.importClause.namedBindings;
            if (ts.isNamespaceImport(bindings)) {
              this.imports.set(bindings.name.text, { path, ident: bindings.name, stmt, pkg });
            } else if (ts.isNamedImports(bindings)) {
              for (const n of bindings.elements) {
                this.imports.set(n.name.text, { path, ident: n.name, stmt, pkg });
              }
            }
          }
        }
      }
    }
  }

  addImport(imports: Import[], file = this.source) {
    try {
      const importStmts = imports.map(({ path, ident }) => {
        const imptStmt = ts.createImportDeclaration(
          undefined, undefined,
          ts.createImportClause(undefined, ts.createNamespaceImport(ident)),
          ts.createLiteral(require.resolve(path))
        );
        return imptStmt;
      });

      const out = ts.updateSourceFileNode(file,
        ts.createNodeArray([
          ...importStmts,
          ...file.statements.filter(x => !(x as any).remove) // Exclude culled imports
        ]),
        file.isDeclarationFile, file.referencedFiles,
        file.typeReferenceDirectives, file.hasNoDefaultLib);

      return out;
    } catch (err) { // Missing import
      if (file.fileName.includes('/extension/')) {
        return file; // Swallow missing extensions
      } else {
        const out = new Error(`${err.message} in ${file.fileName.replace(`${Env.cwd}/`, '')}`);
        out.stack = err.stack;
        throw out;
      }
    }
  }

  importTypeIfExternal(typeNode: ts.TypeNode | ts.Identifier) {
    //    let { path, name: declName, ident: decl } = this.getTypeInfoForNode(node);

    const nodeName = ts.isTypeNode(typeNode) ?
      ((typeNode as ts.TypeReferenceNode).typeName as any)?.['text'] :
      ((typeNode as ts.Identifier).text || (typeNode as ts.Identifier).escapedText as string);

    if (nodeName.match(/^[A-Z]{1,2}$/)) {
      throw new Error('Type information not found');
    }

    if (nodeName.indexOf('.') > 0) {
      const [importName, ident] = nodeName.split('.');

      if (this.imports.has(importName)) {
        const pth = this.imports.get(importName)!.path;
        const importIdent = this.importFile(pth).ident;
        return ts.createPropertyAccess(importIdent, ident);
      }
      return ts.createPropertyAccess(ts.createIdentifier(importName), ident);
    } else {
      const ident = nodeName;
      // External
      if (this.imports.has(nodeName)) {
        const pth = this.imports.get(nodeName)!.path;
        const importName = this.importFile(pth).ident;
        return ts.createPropertyAccess(importName, ident);
      } else {
        return ts.createIdentifier(nodeName);
      }
    }
  }

  importFile(pth: string) {
    if (!this.newImports.has(pth)) {
      const id = `i_${SystemUtil.naiveHash(pth)}`;

      if (this.imports.has(id)) { // Already imported, be cool
        return this.imports.get(id)!;
      }

      const ident = ts.createIdentifier(id);
      const imprt = {
        path: pth,
        ident
      };
      this.imports.set(ident.escapedText.toString(), imprt);
      this.newImports.set(pth, imprt);
    }
    return this.newImports.get(pth)!;
  }

  importDecorator(pth: string, name: string) {
    if (!this.decorators.has(name)) {
      const ref = this.importFile(pth);
      const ident = ts.createIdentifier(name);
      this.decorators.set(name, ts.createPropertyAccess(ref.ident, ident));
    }
  }

  createDecorator(name: string, ...contents: (ts.Expression | undefined)[]) {
    return ts.createDecorator(
      ts.createCall(
        this.decorators.get(name)!,
        undefined,
        contents.filter(x => !!x) as ts.Expression[]
      )
    );
  }

  finalize(ret: ts.SourceFile) {
    if (this.newImports.size) {
      ret = this.addImport(Array.from(this.newImports.values()), ret);
    }

    for (const el of ret.statements) {
      if (!el.parent) {
        el.parent = ret;
      }
    }
    return ret;
  }

  resolveType(type: ts.Node): ts.Expression { // Should get replaced with TypeChecker as needed
    let expr: ts.Expression | undefined;
    const kind = type && type!.kind;

    switch (kind) {
      case ts.SyntaxKind.InterfaceDeclaration:
      case ts.SyntaxKind.ClassDeclaration: {
        const decl = (type as ts.InterfaceDeclaration);
        const fileName = decl.getSourceFile().fileName;
        if (fileName.endsWith('.d.ts')) {
          return this.resolveType(null as any);
        }
        const { ident } = this.imports.get(fileName) ?? this.importFile(fileName);
        expr = ts.createPropertyAccess(ident, decl.name);
        break;
      }
      case ts.SyntaxKind.TypeReference: {
        expr = this.importTypeIfExternal(type as ts.TypeReferenceNode);

        // Wrapping reference to handle interfaces, and failing gracefully
        // const imp = this.importFile(FsUtil.resolveUnix(__dirname, '../util'));
        // expr = ts.createCall(
        //   ts.createPropertyAccess(ts.createPropertyAccess(imp.ident, 'CompilerUtil'), 'resolveAsType'), undefined,
        //   [
        //     ts.createArrowFunction(undefined, undefined,
        //       ts.createNodeArray([]), undefined, ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), expr),
        //     ts.createLiteral(type.getText())
        //   ]);
        break;
      }
      case ts.SyntaxKind.VoidKeyword: expr = ts.createIdentifier('undefined'); break;
      case ts.SyntaxKind.LiteralType: expr = this.resolveType((type as any as ts.LiteralTypeNode).literal); break;
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.StringKeyword: expr = ts.createIdentifier('String'); break;
      case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.NumberKeyword: expr = ts.createIdentifier('Number'); break;
      case ts.SyntaxKind.TrueKeyword:
      case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.BooleanKeyword: expr = ts.createIdentifier('Boolean'); break;
      case ts.SyntaxKind.ArrayType:
        expr = ts.createArrayLiteral([this.resolveType((type as ts.ArrayTypeNode).elementType)]);
        break;
      case ts.SyntaxKind.TypeLiteral: {
        const properties: ts.PropertyAssignment[] = [];
        for (const member of (type as ts.TypeLiteralNode).members) {
          let subMember: ts.TypeNode = (member as any).type;
          if ((subMember as any).literal) {
            subMember = (subMember as any).literal;
          }
          properties.push(ts.createPropertyAssignment(member.name as ts.Identifier, this.resolveType(subMember)));
        }
        expr = ts.createObjectLiteral(properties);
        break;
      }
      case ts.SyntaxKind.UnionType: {
        const types = (type as ts.UnionTypeNode).types;
        expr = types.slice(1).reduce((fType, stype) => {
          const fTypeStr = (fType as any).text;
          if (fTypeStr !== 'Object') {
            const resolved = this.resolveType(stype);
            if ((resolved as any).text !== fTypeStr) {
              fType = ts.createIdentifier('Object');
            }
          }
          return fType;
        }, this.resolveType(types[0]));
        break;
      }
      case ts.SyntaxKind.TupleType:
        expr = ts.createArrayLiteral((type as ts.TupleTypeNode).elementTypes.map(t => this.resolveType(t)));
        break;
      case ts.SyntaxKind.ObjectKeyword:
      default:
        break;
    }
    return expr || ts.createIdentifier('Object');
  }

  describeByComments(node: ts.Node) {
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