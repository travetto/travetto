import * as ts from 'typescript';
import { basename, dirname, relative } from 'path';

import { PathUtil } from '@travetto/boot';
import { ModuleUtil } from '@travetto/boot/src/internal/module-util';

import { AnyType, ExternalType } from './resolver/types';
import { ImportUtil } from './util/import';
import { CoreUtil } from './util/core';
import { Import } from './types/shared';

const D_OR_D_TS_EXT_RE = /[.]d([.]ts)?$/;

/**
 * Manages imports within a ts.SourceFile
 */
export class ImportManager {

  #newImports = new Map<string, Import>();
  #imports: Map<string, Import>;
  #idx: Record<string, number> = {};
  #ids = new Map<string, string>();

  constructor(public source: ts.SourceFile, public factory: ts.NodeFactory) {
    this.#imports = ImportUtil.collectImports(source);
  }

  /**
   * Produces a unique ID for a given file, importing if needed
   */
  getId(file: string): string {
    if (!this.#ids.has(file)) {
      const key = basename(file).replace(/[.][^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '_');
      this.#ids.set(file, `ᚕ_${key}_${this.#idx[key] = (this.#idx[key] || 0) + 1}`);
    }
    return this.#ids.get(file)!;
  }

  /**
   * Import a file if needed, and record it's identifier
   */
  importFile(file: string, base?: string): Import {
    file = ModuleUtil.normalizePath(file);

    // Allow for node classes to be imported directly
    if (/@types\/node/.test(file)) {
      file = require.resolve(file.replace(/.*@types\/node\//, '').replace(D_OR_D_TS_EXT_RE, ''));
    }

    // Handle relative imports
    if (file.startsWith('.') && base &&
      !base.startsWith('@travetto') && !base.includes('node_modules')
    ) { // Relative path
      const fileDir = dirname(PathUtil.resolveUnix(file));
      const baseDir = dirname(PathUtil.resolveUnix(base));
      file = `${relative(baseDir, fileDir) || '.'}/${basename(file)}`;
      if (/^[A-Za-z]/.test(file)) {
        file = `./${file}`;
      }
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
      if (type.key === 'external' && type.source && type.source !== this.source.fileName) {
        this.importFile(type.source, this.source.fileName);
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
      const out = new Error(`${err.message} in ${file.fileName.replace(PathUtil.cwd, '.')}`);
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
    if (type.source === this.source.fileName) {
      return factory.createIdentifier(type.name!);
    } else {
      const { ident } = this.#imports.get(type.source) ?? this.importFile(type.source, this.source.fileName);
      return factory.createPropertyAccessExpression(ident, type.name!);
    }
  }
}