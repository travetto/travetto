import * as ts from 'typescript';
import { resolve as pathResolve } from 'path';

import { PathUtil } from '@travetto/boot';

import { Import } from '../types/shared';

/**
 * Import utilities
 */
export class ImportUtil {
  /*
   * useful for handling failed imports, but still transpiling
   */
  static optionalResolve(file: string, base?: string): string {
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
  static collectImports(src: ts.SourceFile): Map<string, Import> {
    const pth = require.resolve(src.fileName);
    const base = PathUtil.toUnix(pth);

    const imports = new Map<string, Import>();

    for (const stmt of src.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const path = this.optionalResolve(stmt.moduleSpecifier.text, base);

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
}