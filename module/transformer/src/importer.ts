import * as ts from 'typescript';

import { path } from '@travetto/common';

import { AnyType, ExternalType } from './resolver/types';
import { ImportUtil } from './util/import';
import { CoreUtil } from './util/core';
import { Import } from './types/shared';

import { ManifestManager } from './manifest';
import { SystemUtil } from './util/system';

const D_OR_D_TS_EXT_RE = /[.]d([.]ts)?$/;

/**
 * Manages imports within a ts.SourceFile
 */
export class ImportManager {

  #newImports = new Map<string, Import>();
  #imports: Map<string, Import>;
  #idx: Record<string, number> = {};
  #ids = new Map<string, string>();
  #file: string;
  #manifest: ManifestManager;

  constructor(public source: ts.SourceFile, public factory: ts.NodeFactory, manifest: ManifestManager) {
    this.#imports = ImportUtil.collectImports(source);
    this.#file = path.toPosix(source.fileName);
    this.#manifest = manifest;
  }

  /**
   * Produces a unique ID for a given file, importing if needed
   */
  getId(file: string): string {
    if (!this.#ids.has(file)) {
      const key = path.basename(file).replace(/[.][^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '_');
      this.#ids.set(file, `Ⲑ_${key}_${this.#idx[key] = (this.#idx[key] || 0) + 1}`);
    }
    return this.#ids.get(file)!;
  }

  /**
   * Import a file if needed, and record it's identifier
   */
  importFile(file: string, base?: string): Import {
    file = this.#manifest.resolveModule(file);

    // Allow for node classes to be imported directly
    if (/@types\/node/.test(file)) {
      file = SystemUtil.resolveImport(file.replace(/.*@types\/node\//, '').replace(D_OR_D_TS_EXT_RE, ''));
    }

    if (!D_OR_D_TS_EXT_RE.test(file) && !this.#newImports.has(file)) {
      const id = this.getId(file);

      if (this.#imports.has(id)) { // Already imported, be cool
        return this.#imports.get(id)!;
      }

      const ident = this.factory.createIdentifier(id);
      const newImport = { path: file, ident };
      this.#imports.set(ident.escapedText.toString(), newImport);
      this.#newImports.set(file, newImport);
    }
    return this.#newImports.get(file)!;
  }

  /**
   * Import given an external type
   */
  importFromResolved(...types: AnyType[]): void {
    for (const type of types) {
      if (type.key === 'external' && type.source && type.source !== this.#file) {
        this.importFile(type.source, this.#file);
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
   * Add imports to a source file
   */
  finalizeNewImports(file: ts.SourceFile): ts.SourceFile | undefined {
    if (!this.#newImports.size) {
      return;
    }

    try {
      const importStmts = [...this.#newImports.values()].map(({ path, ident }) => {
        const importStmt = this.factory.createImportDeclaration(
          undefined,
          this.factory.createImportClause(false, undefined, this.factory.createNamespaceImport(ident)),
          this.factory.createStringLiteral(path)
        );
        return importStmt;
      });

      return CoreUtil.updateSource(this.factory, file, [
        ...importStmts,
        ...file.statements.filter((x: ts.Statement & { remove?: boolean }) => !x.remove) // Exclude culled imports
      ]);
    } catch (err) { // Missing import
      if (!(err instanceof Error)) {
        throw err;
      }
      const out = new Error(`${err.message} in ${file.fileName.replace(process.cwd(), '.')}`);
      out.stack = err.stack;
      throw out;
    }
  }

  /**
   * Reset the imports into the source file
   */
  finalize(ret: ts.SourceFile): ts.SourceFile {
    return this.finalizeNewImports(ret) ?? ret;
  }

  /**
   * Get the identifier and import if needed
   */
  getOrImport(factory: ts.NodeFactory, type: ExternalType): ts.Identifier | ts.PropertyAccessExpression {
    if (type.source === this.#file) {
      return factory.createIdentifier(type.name!);
    } else {
      const { ident } = this.#imports.get(type.source) ?? this.importFile(type.source, this.#file);
      return factory.createPropertyAccessExpression(ident, type.name!);
    }
  }
}