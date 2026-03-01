import ts from 'typescript';

import { ManifestModuleUtil, PackageUtil, path } from '@travetto/manifest';

import type { AnyType, TransformResolver, ManagedType, MappedType } from './resolver/types.ts';
import { ImportUtil } from './util/import.ts';
import { CoreUtil } from './util/core.ts';
import type { Import } from './types/shared.ts';
import { LiteralUtil } from './util/literal.ts';
import { DeclarationUtil } from './util/declaration.ts';

const D_OR_D_TS_EXT_REGEX = /[.]d([.]ts)?$/;

/**
 * Manages imports within a ts.SourceFile
 */
export class ImportManager {

  #newImports = new Map<string, Import>();
  #imports: Map<string, Import>;
  #idx: Record<string, number> = {};
  #identifiers = new Map<string, ts.Identifier>();
  #importName: string;
  #resolver: TransformResolver;

  source: ts.SourceFile;
  factory: ts.NodeFactory;

  constructor(source: ts.SourceFile, factory: ts.NodeFactory, resolver: TransformResolver) {
    this.#imports = ImportUtil.collectImports(source);
    this.#resolver = resolver;
    this.#importName = this.#resolver.getFileImportName(source.fileName);
    this.source = source;
    this.factory = factory;
  }

  #rewriteImportClause(expr: ts.Expression | undefined, clause: ts.ImportClause | undefined): ts.ImportClause | undefined {
    if (!(expr && clause?.namedBindings && ts.isNamedImports(clause.namedBindings))) {
      return clause;
    }

    if (expr && ts.isStringLiteral(expr) && !this.#isKnownImport(expr)) {
      return clause;
    }

    const bindings = clause.namedBindings;
    const newBindings: ts.ImportSpecifier[] = [];
    // Remove all type only imports
    for (const element of bindings.elements) {
      if (!element.isTypeOnly) {
        const type = this.#resolver.getType(element.name);
        const objFlags = DeclarationUtil.getObjectFlags(type);
        const typeFlags = type.getFlags();
        // eslint-disable-next-line no-bitwise
        if (!(objFlags & (ts.SymbolFlags.Type | ts.SymbolFlags.Interface)) || !(typeFlags & ts.TypeFlags.Any)) {
          newBindings.push(element);
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
   * Is a known import an untyped file access
   * @param fileOrImport
   */
  #isKnownImport(fileOrImport: ts.StringLiteral | string | undefined): boolean {
    if (fileOrImport && typeof fileOrImport !== 'string') {
      if (ts.isStringLiteral(fileOrImport)) {
        fileOrImport = fileOrImport.text.replace(/['"]g/, '');
      } else {
        return false;
      }
    }

    return fileOrImport ?
      (fileOrImport.startsWith('.') || this.#resolver.isKnownFile(fileOrImport)) :
      false;
  }

  /**
   * Normalize module specifier
   */
  normalizeModuleSpecifier<T extends ts.Expression | undefined>(specifier: T): T {
    if (specifier && ts.isStringLiteral(specifier) && this.#isKnownImport(specifier.text)) {
      const specText = specifier.text.replace(/['"]/g, '');

      const type = ManifestModuleUtil.getFileType(specText);
      if (type === 'js' || type === 'ts') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return LiteralUtil.fromLiteral(this.factory, ManifestModuleUtil.withOutputExtension(specText)) as unknown as T;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return LiteralUtil.fromLiteral(this.factory, `${specText}${ManifestModuleUtil.OUTPUT_EXT}`) as unknown as T;
      }
    }
    return specifier;
  }

  /**
   * Produces a unique identifier for a given file
   */
  getIdentifier(file: string, name?: string): ts.Identifier {
    return this.#identifiers.getOrInsertComputed(file, () => {
      if (name) {
        return this.factory.createIdentifier(name);
      } else {
        const key = path.basename(file, path.extname(file)).replace(/\W+/g, '_');
        const suffix = this.#idx[key] = (this.#idx[key] ?? -1) + 1;
        return this.factory.createIdentifier(`Δ${key}${suffix ? suffix : ''}`);
      }
    });
  }

  /**
   * Import a file if needed, and record it's identifier
   */
  importFile(file: string, name?: string): Import {
    file = this.#resolver.getFileImportName(file);

    if (file.endsWith(ManifestModuleUtil.SOURCE_DEF_EXT) && !file.endsWith(ManifestModuleUtil.TYPINGS_EXT)) {
      file = ManifestModuleUtil.withOutputExtension(file);
    }

    // Allow for node classes to be imported directly
    if (/@types\/node\//.test(file)) {
      file = PackageUtil.resolveImport(file.split('@types/node/')[1].replace(D_OR_D_TS_EXT_REGEX, ''));
    }

    if (!D_OR_D_TS_EXT_REGEX.test(file) && !this.#newImports.has(file)) {
      const identifier = this.getIdentifier(file, name);
      const uniqueName = identifier.text;

      if (this.#imports.has(uniqueName)) { // Already imported, be cool
        return this.#imports.get(uniqueName)!;
      }

      const newImport = { path: file, identifier };
      this.#imports.set(uniqueName, newImport);
      this.#newImports.set(file, newImport);
    }
    return this.#newImports.get(file)!;
  }

  /**
   * Import given an external type
   */
  importFromResolved(...types: AnyType[]): void {
    for (const type of types) {
      if (type.key === 'managed' && type.importName && type.importName !== this.#importName) {
        this.importFile(type.importName);
      }
      switch (type.key) {
        case 'managed':
        case 'literal': this.importFromResolved(...type.typeArguments || []); break;
        case 'composition':
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
      const importStmts = [...this.#newImports.values()].map(({ path: resolved, identifier }) => {
        const importStmt = this.factory.createImportDeclaration(
          undefined,
          this.factory.createImportClause(undefined, undefined, this.factory.createNamespaceImport(identifier)),
          this.factory.createStringLiteral(resolved)
        );
        return importStmt;
      });

      return CoreUtil.updateSource(this.factory, file, [
        ...importStmts,
        ...file.statements.filter((node: ts.Statement & { remove?: boolean }) => !node.remove) // Exclude culled imports
      ]);
    } catch (error) { // Missing import
      if (!(error instanceof Error)) {
        throw error;
      }
      const out = new Error(`${error.message} in ${file.fileName.replace(process.cwd(), '.')}`);
      out.stack = error.stack;
      throw out;
    }
  }

  finalizeImportExportExtension(source: ts.SourceFile): ts.SourceFile {
    const toAdd: ts.Statement[] = [];

    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (!statement.isTypeOnly) {
          toAdd.push(this.factory.updateExportDeclaration(
            statement,
            statement.modifiers,
            statement.isTypeOnly,
            statement.exportClause,
            this.normalizeModuleSpecifier(statement.moduleSpecifier),
            statement.attributes
          ));
        }
      } else if (ts.isImportDeclaration(statement)) {
        if (statement.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword) {
          toAdd.push(this.factory.updateImportDeclaration(
            statement,
            statement.modifiers,
            this.#rewriteImportClause(statement.moduleSpecifier, statement.importClause)!,
            this.normalizeModuleSpecifier(statement.moduleSpecifier)!,
            statement.attributes
          ));
        }
      } else {
        toAdd.push(statement);
      }
    }
    return CoreUtil.updateSource(this.factory, source, toAdd);
  }

  /**
   * Reset the imports into the source file
   */
  finalize(source: ts.SourceFile): ts.SourceFile {
    let node = this.finalizeNewImports(source) ?? source;
    node = this.finalizeImportExportExtension(node) ?? node;
    return node;
  }

  /**
   * Get the identifier and import if needed
   */
  getOrImport(factory: ts.NodeFactory, type: ManagedType | MappedType): ts.Identifier | ts.PropertyAccessExpression {
    const targetName = type.key === 'managed' ? type.name! : type.mappedClassName!;
    // In same file already
    if (type.importName === this.#importName) {
      return factory.createIdentifier(targetName);
    } else {
      const { identifier } = this.#imports.get(type.importName) ?? this.importFile(type.importName);
      return factory.createPropertyAccessExpression(identifier, targetName);
    }
  }
}