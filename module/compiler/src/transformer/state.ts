import * as ts from 'typescript';
import { dirname } from 'path';

import { FsUtil, RegisterUtil } from '@travetto/boot';
import { SystemUtil, Env } from '@travetto/base';

import { TransformUtil } from './util';
import { Import } from './types';
import { TypeChecker } from './checker';

export class TransformerState {
  readonly path: string;
  readonly modulePath: string;

  readonly newImports = new Map<string, Import>();
  readonly decorators = new Map<string, ts.PropertyAccessExpression>();
  readonly imports = new Map<string, Import>();
  readonly ids = new Map<string, number>();
  checker: TypeChecker;

  constructor(public source: ts.SourceFile, checker: ts.TypeChecker) {
    const pth = require.resolve(source.fileName);
    this.path = FsUtil.resolveNative(pth);
    this.modulePath = FsUtil.resolveUnix(pth);
    this.collectInitialImports();
    this.checker = new TypeChecker(checker);
  }

  getOrImport(type: ts.Type) {
    const file = type.symbol.getDeclarations()![0].getSourceFile().fileName;
    const name = type.symbol.getName();

    if (file === this.source.fileName) {
      return ts.createIdentifier(name);
    } else {
      const { ident } = this.imports.get(file) ?? this.importFile(file);
      return ts.createPropertyAccess(ident, name);
    }
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
}