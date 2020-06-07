import * as ts from 'typescript';
import { basename } from 'path';

import { AnyType, ExternalType } from './resolver/types';
import { ImportUtil } from './util/import';
import { Import } from './types/shared';

/**
 * Manages imports within a ts.SourceFile
 */
export class ImportManager {


  private newImports = new Map<string, Import>();
  private imports: Map<string, Import>;
  private idx: Record<string, number> = {};
  private ids = new Map<string, string>();

  constructor(public source: ts.SourceFile) {
    this.imports = ImportUtil.collectImports(source);
  }

  /**
   * Produces a unique ID for a given file, importing if needed
   */
  getId(file: string) {
    if (!this.ids.has(file)) {
      const key = basename(file).replace(/[.][^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '_');
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
  importFromResolved(...types: AnyType[]) {
    for (const type of types) {
      if (type.key === 'external' && type.source && type.source !== this.source.fileName) {
        this.importFile(type.source);
      }
      switch (type.key) {
        case 'external':
        case 'literal': this.importFromResolved(...type.typeArguments || []); break;
        case 'union':
        case 'tuple': this.importFromResolved(...type.subTypes || []); break;
        case 'shape': this.importFromResolved(...Object.values(type.fieldTypes)); break;
      }
    }
  }

  /**
   * Reset the imports into the source file
   */
  finalize(ret: ts.SourceFile) {
    return ImportUtil.addImports(ret, ...this.newImports.values());
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