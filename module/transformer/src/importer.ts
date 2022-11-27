import ts from 'typescript';

import { PackageUtil, path } from '@travetto/manifest';

import { AnyType, ExternalType } from './resolver/types';
import { ImportUtil } from './util/import';
import { CoreUtil } from './util/core';
import { Import } from './types/shared';
import { LiteralUtil } from './util/literal';
import { DeclarationUtil } from './util/declaration';

import { ManifestManager } from './manifest';

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

  #getImportFile(spec?: ts.Expression): string | undefined {
    if (spec && ts.isStringLiteral(spec)) {
      return spec.text.replace(/^['"]|["']$/g, '');
    }
  }

  #rewriteModuleSpecifier(spec: ts.Expression | undefined): ts.Expression | undefined {
    const file = this.#getImportFile(spec);
    if (
      file &&
      (file.startsWith('.') || this.#manifest.knownFile(file)) &&
      !/[.]([mc]?js|ts|json)$/.test(file)
    ) {
      if (file.endsWith('..') || file.endsWith('../')) {
        return LiteralUtil.fromLiteral(this.factory, `${file.replace(/[/]$/, '')}/index.js`);
      } else {
        return LiteralUtil.fromLiteral(this.factory, `${file}.js`);
      }
    }
    return spec;
  }

  #rewriteImportClause(
    spec: ts.Expression | undefined,
    clause: ts.ImportClause | undefined,
    checker: ts.TypeChecker
  ): ts.ImportClause | undefined {
    if (!(spec && clause?.namedBindings && ts.isNamedImports(clause.namedBindings))) {
      return clause;
    }

    const file = this.#getImportFile(spec);
    if (!(file && (file.startsWith('.') || this.#manifest.knownFile(file)))) {
      return clause;
    }

    const bindings = clause.namedBindings;
    const newBindings: ts.ImportSpecifier[] = [];
    // Remove all type only imports
    for (const el of bindings.elements) {
      if (!el.isTypeOnly) {
        const type = checker.getTypeAtLocation(el.name);
        const objFlags = DeclarationUtil.getObjectFlags(type);
        const typeFlags = type.getFlags();
        if (objFlags || typeFlags !== 1) {
          newBindings.push(el);
        }
      }
    }
    if (newBindings.length !== bindings.elements.length) {
      return this.factory.updateImportClause(
        clause,
        clause.isTypeOnly,
        clause.name,
        this.factory.createNamedImports(newBindings)
      );
    } else {
      return clause;
    }
  }

  /**
   * Produces a unique ID for a given file, importing if needed
   */
  getId(file: string, name?: string): string {
    if (!this.#ids.has(file)) {
      if (name) {
        this.#ids.set(file, name);
      } else {
        const key = path.basename(file).replace(/[.][^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '_');
        this.#ids.set(file, `Ⲑ_${key}_${this.#idx[key] = (this.#idx[key] || 0) + 1}`);
      }
    }
    return this.#ids.get(file)!;
  }

  /**
   * Import a file if needed, and record it's identifier
   */
  importFile(file: string, name?: string): Import {
    file = this.#manifest.resolveModule(file);

    // Allow for node classes to be imported directly
    if (/@types\/node/.test(file)) {
      file = PackageUtil.resolveImport(file.replace(/.*@types\/node\//, '').replace(D_OR_D_TS_EXT_RE, ''));
    }

    if (!D_OR_D_TS_EXT_RE.test(file) && !this.#newImports.has(file)) {
      const id = this.getId(file, name);

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
   * Add imports to a source file
   */
  finalizeNewImports(file: ts.SourceFile): ts.SourceFile | undefined {
    if (!this.#newImports.size) {
      return;
    }

    try {
      const importStmts = [...this.#newImports.values()].map(({ path: resolved, ident }) => {
        const importStmt = this.factory.createImportDeclaration(
          undefined,
          this.factory.createImportClause(false, undefined, this.factory.createNamespaceImport(ident)),
          this.factory.createStringLiteral(resolved)
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

  finalizeImportExportExtension(ret: ts.SourceFile, checker: ts.TypeChecker): ts.SourceFile {
    const toAdd: ts.Statement[] = [];

    for (const stmt of ret.statements) {
      if (ts.isExportDeclaration(stmt)) {
        if (!stmt.isTypeOnly) {
          toAdd.push(this.factory.updateExportDeclaration(
            stmt,
            stmt.modifiers,
            stmt.isTypeOnly,
            stmt.exportClause,
            this.#rewriteModuleSpecifier(stmt.moduleSpecifier),
            stmt.assertClause
          ));
        }
      } else if (ts.isImportDeclaration(stmt)) {
        if (!stmt.importClause?.isTypeOnly) {
          toAdd.push(this.factory.updateImportDeclaration(
            stmt,
            stmt.modifiers,
            this.#rewriteImportClause(stmt.moduleSpecifier, stmt.importClause, checker)!,
            this.#rewriteModuleSpecifier(stmt.moduleSpecifier)!,
            stmt.assertClause
          ));
        }
      } else {
        toAdd.push(stmt);
      }
    }
    return CoreUtil.updateSource(this.factory, ret, toAdd);
  }

  /**
   * Reset the imports into the source file
   */
  finalize(ret: ts.SourceFile, checker: ts.TypeChecker): ts.SourceFile {
    ret = this.finalizeNewImports(ret) ?? ret;
    ret = this.finalizeImportExportExtension(ret, checker) ?? ret;
    return ret;
  }

  /**
   * Get the identifier and import if needed
   */
  getOrImport(factory: ts.NodeFactory, type: ExternalType): ts.Identifier | ts.PropertyAccessExpression {
    if (type.source === this.#file) {
      return factory.createIdentifier(type.name!);
    } else {
      const { ident } = this.#imports.get(type.source) ?? this.importFile(type.source);
      return factory.createPropertyAccessExpression(ident, type.name!);
    }
  }
}