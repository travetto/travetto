import * as ts from 'typescript';
import { resolve as pathResolve } from 'path';

import { FsUtil } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';

import { Import } from '../types/shared';
import { CoreUtil } from './core';

/**
 * Import utilities
 */
export class ImportUtil {
  /*
   * useful for handling failed imports, but still transpiling
   */
  static optionalResolve(file: string, base?: string) {
    file = base ? pathResolve(base, file) : file;
    try {
      return require.resolve(file);
    } catch {
      return file;
    }
  }

  /**
   * Collect all imports for a source file, as a hash map
   */
  static collectImports(src: ts.SourceFile) {
    const pth = require.resolve(src.fileName);
    const base = FsUtil.toUnix(pth);

    const imports = new Map<string, Import>();

    for (const stmt of src.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        let path = this.optionalResolve(stmt.moduleSpecifier.text, base);
        path = FrameworkUtil.resolvePath(path);

        if (stmt.importClause) {
          if (stmt.importClause.namedBindings) {
            const bindings = stmt.importClause.namedBindings;
            if (ts.isNamespaceImport(bindings)) {
              imports.set(bindings.name.text, { path, ident: bindings.name, stmt });
            } else if (ts.isNamedImports(bindings)) {
              for (const n of bindings.elements) {
                imports.set(n.name.text, { path, ident: n.name, stmt });
              }
            }
          }
        }
      }
    }

    return imports;
  }

  /**
   * Add imports to a source file
   */
  static addImports(file: ts.SourceFile, ...imports: Import[]) {
    if (!imports.length) {
      return file;
    }

    try {
      const importStmts = imports.map(({ path, ident }) => {
        const imptStmt = ts.createImportDeclaration(
          undefined, undefined,
          ts.createImportClause(undefined, ts.createNamespaceImport(ident)),
          ts.createLiteral(path.replace(/^.*node_modules\//, '').replace(FsUtil.cwd, '@app'))
        );
        return imptStmt;
      });

      return CoreUtil.updateSource(file, [
        ...importStmts,
        ...file.statements.filter((x: ts.Statement & { remove?: boolean }) => !x.remove) // Exclude culled imports
      ]);
    } catch (err) { // Missing import
      const out = new Error(`${err.message} in ${file.fileName.replace(`${FsUtil.cwd}/`, '')}`);
      out.stack = err.stack;
      throw out;
    }
  }
}