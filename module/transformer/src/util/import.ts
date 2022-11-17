import * as ts from 'typescript';

import { path } from '@travetto/manifest';

import { Import } from '../types/shared';
import { SystemUtil } from './system';

/**
 * Import utilities
 */
export class ImportUtil {
  /*
   * useful for handling failed imports, but still transpiling
   */
  static optionalResolve(file: string, base?: string): string {
    if (base?.endsWith('.ts')) {
      base = path.dirname(base);
    }
    if (base && file.startsWith('.')) {
      const resolved = path.resolve(base, file);
      return resolved;
      // TODO: Replace with manifest reverse lookup
    } else if (file.startsWith('@')) {
      return path.resolve('node_modules', file);
    }
    try {
      return SystemUtil.resolveImport(file);
    } catch {
      return file;
    }
  }

  /**
   * Collect all imports for a source file, as a hash map
   */
  static collectImports(src: ts.SourceFile): Map<string, Import> {
    // TODO: Replace with manifest reverse lookup
    const base = path.toPosix(src.fileName);

    const imports = new Map<string, Import>();

    for (const stmt of src.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const resolved = this.optionalResolve(stmt.moduleSpecifier.text, base);

        if (stmt.importClause) {
          if (stmt.importClause.namedBindings) {
            const bindings = stmt.importClause.namedBindings;
            if (ts.isNamespaceImport(bindings)) {
              imports.set(bindings.name.text, { path: resolved, ident: bindings.name, stmt });
            } else if (ts.isNamedImports(bindings)) {
              for (const n of bindings.elements) {
                imports.set(n.name.text, { path: resolved, ident: n.name, stmt });
              }
            }
          }
        }
      }
    }

    return imports;
  }
}