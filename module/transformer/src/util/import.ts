import ts from 'typescript';

import { path, ManifestModuleUtil, PackageUtil } from '@travetto/manifest';

import type { Import } from '../types/shared.ts';

/**
 * Import utilities
 */
export class ImportUtil {
  /*
   * useful for handling failed imports, but still transpiling
   */
  static optionalResolve(file: string, base?: string): string {
    if (base && ManifestModuleUtil.getFileType(base) === 'ts') {
      base = path.dirname(base);
    }
    if (base && file.startsWith('.')) {
      return path.resolve(base, file);
      // TODO: Replace with manifest reverse lookup
    } else if (file.startsWith('@')) {
      return path.resolve('node_modules', file);
    }
    try {
      return PackageUtil.resolveImport(file);
    } catch {
      return file;
    }
  }

  /**
   * Collect all imports for a source file, as a hash map
   */
  static collectImports(source: ts.SourceFile): Map<string, Import> {
    // TODO: Replace with manifest reverse lookup
    const base = path.toPosix(source.fileName);

    const imports = new Map<string, Import>();

    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const resolved = this.optionalResolve(statement.moduleSpecifier.text, base);

        if (statement.importClause) {
          if (statement.importClause.namedBindings) {
            const bindings = statement.importClause.namedBindings;
            if (ts.isNamespaceImport(bindings)) {
              imports.set(bindings.name.text, { path: resolved, identifier: bindings.name, statement });
            } else if (ts.isNamedImports(bindings)) {
              for (const element of bindings.elements) {
                imports.set(element.name.text, { path: resolved, identifier: element.name, statement });
              }
            }
          }
        }
      }
    }

    return imports;
  }
}