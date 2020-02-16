import * as ts from 'typescript';
import { dirname } from 'path';

import { FsUtil, RegisterUtil } from '@travetto/boot';
import { Env, SystemUtil } from '@travetto/base';

import { Import } from './types/importer';
import * as res from './types/resolver';

import { TransformUtil } from './util';

export class ImportManager {
  private path: string;

  readonly newImports = new Map<string, Import>();
  readonly imports = new Map<string, Import>();

  constructor(public source: ts.SourceFile) {
    const pth = require.resolve(source.fileName);
    this.path = FsUtil.resolveNative(pth);
    this.collectInitialImports();
  }

  private collectInitialImports() {
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

  private addImport(imports: Import[], file = this.source) {
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

  importFile(pth: string) {
    if (!pth.endsWith('.d.ts') && !this.newImports.has(pth)) {
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

  importFromResolved(type: res.Type) {
    if (res.isExternalType(type)) {
      if (type.source && type.source !== this.source.fileName) {
        this.importFile(type.source);
      }
    }

    const nested = res.isExternalType(type) ? type.typeArguments :
      (res.isUnionType(type) ? type.unionTypes :
        (res.isTupleType(type) ? type.tupleTypes : undefined));

    if (nested) {
      for (const sub of nested) {
        this.importFromResolved(sub);
      }
    }
  }

  finalize(ret: ts.SourceFile) {
    return this.newImports.size ?
      this.addImport(Array.from(this.newImports.values()), ret) :
      ret;
  }

  getOrImport(type: res.ExternalType) {
    if (type.source === this.source.fileName) {
      return ts.createIdentifier(type.name!);
    } else {
      const { ident } = this.imports.get(type.source) ?? this.importFile(type.source);
      return ts.createPropertyAccess(ident, type.name!);
    }
  }
}