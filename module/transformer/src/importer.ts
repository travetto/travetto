import * as ts from 'typescript';
import * as path from 'path';

import { AnyType, ExternalType } from './resolver/types';
import { Import } from './types/shared';
import { TransformUtil } from './util';

/**
 * Manages imports within a ts.SourceFile
 */
export class ImportManager {
  private newImports = new Map<string, Import>();
  private imports: Map<string, Import>;
  private idx: Record<string, number> = {};
  private ids = new Map<string, string>();

  constructor(public source: ts.SourceFile) {
    this.imports = TransformUtil.collectImports(source);
  }

  /**
   * Produces a unique ID for a given file, importing if needed
   */
  getId(file: string) {
    if (!this.ids.has(file)) {
      const key = path.basename(file).replace(/[.][^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '_');
      this.ids.set(file, `ᚕ_${key}_${this.idx[key] = (this.idx[key] || 0) + 1}`);
    }
    return this.ids.get(file)!;
  }

  /**
   * Import a file if needed, and record it's identifier
   */
  importFile(file: string) {
    if (!file.endsWith('.d.ts') && !this.newImports.has(file)) {
      const id = this.getId(file);

      if (this.imports.has(id)) { // Already imported, be cool
        return this.imports.get(id)!;
      }

      const ident = ts.createIdentifier(id);
      const imprt = { path: file, ident };
      this.imports.set(ident.escapedText.toString(), imprt);
      this.newImports.set(file, imprt);
    }
    return this.newImports.get(file)!;
  }

  /**
   * Import given an external type
   */
  importFromResolved(type: AnyType) {
    let nested: AnyType[] | undefined;
    switch (type.key) {
      case 'external': {
        if (type.source && type.source !== this.source.fileName) {
          this.importFile(type.source);
        }
        nested = type.typeArguments;
      } break;
      case 'union':
      case 'tuple': nested = type.subTypes; break;
    }
    if (nested) {
      for (const sub of nested) {
        this.importFromResolved(sub);
      }
    }
  }

  /**
   * Reset the imports into the source file
   */
  finalize(ret: ts.SourceFile) {
    return TransformUtil.addImports(ret, ...this.newImports.values());
  }

  /**
   * Get the identifier and import if needed
   */
  getOrImport(type: ExternalType) {
    if (type.source === this.source.fileName) {
      return ts.createIdentifier(type.name!);
    } else {
      const { ident } = this.imports.get(type.source) ?? this.importFile(type.source);
      return ts.createPropertyAccess(ident, type.name!);
    }
  }
}