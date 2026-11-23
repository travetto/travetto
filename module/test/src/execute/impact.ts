import fs from 'node:fs/promises';

import { type IndexedFile, type ManifestIndex, path } from '@travetto/manifest';
import { RuntimeIndex } from '@travetto/runtime';

import type { TestEvent } from '../model/event.ts';

const IMPORT_EXPORT_REGEX = /(?:import|export)\s+(?:type\s+)?(?:([^'"`;]*?)\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_DECL_REGEX = /export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|function|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_LIST_REGEX = /export\s+(?:type\s+)?\{([^}]+)\}(?!\s*from)/g;

type ImportedSymbolSet = Set<string> | '*';

/**
 * Lightweight text-based import graph for resolving potentially impacted tests on file changes
 */
export class TestImpactGraph {
  #index: ManifestIndex;
  #dependencies = new Map<string, Set<string>>();
  #importers = new Map<string, Set<string>>();
  #exports = new Map<string, Set<string>>();
  #importedSymbols = new Map<string, Map<string, ImportedSymbolSet>>();
  #failingTests = new Map<string, Set<string>>();
  #lastFailed = new Map<string, number>();
  #failureSequence = 0;

  constructor(index: ManifestIndex = RuntimeIndex) {
    this.#index = index;
  }

  /**
   * Record a test event to prioritize recently failing tests
   */
  recordTestEvent(event: TestEvent): void {
    if (event.type !== 'test' || event.phase !== 'after') {
      return;
    }
    const { import: importName, classId, methodName, status } = event.test;
    const key = `${classId}:${methodName}`;
    if (status === 'failed' || status === 'errored') {
      this.#failingTests.getOrInsert(importName, new Set()).add(key);
      this.#lastFailed.set(importName, (this.#failureSequence += 1));
    } else {
      const failing = this.#failingTests.get(importName);
      if (failing) {
        failing.delete(key);
        if (failing.size === 0) {
          this.#failingTests.delete(importName);
        }
      }
    }
  }

  /**
   * Clear recorded failure state for a removed test import
   */
  clearFailures(importName: string): void {
    this.#failingTests.delete(importName);
    this.#lastFailed.delete(importName);
  }

  #getFailureRank(importName: string): number {
    const sequence = this.#lastFailed.get(importName) ?? 0;
    return (this.#failingTests.get(importName)?.size ? 1_000_000_000 : 0) + sequence;
  }

  /**
   * Sort test imports by failure recency (currently failing first, then most recently failed)
   */
  sortImports(imports: string[]): string[] {
    return [...imports].sort((a, b) => this.#getFailureRank(b) - this.#getFailureRank(a));
  }

  /**
   * Extract exported symbol names from source text
   */
  static extractExports(content: string): Set<string> {
    const exported = new Set<string>();
    for (const match of content.matchAll(EXPORT_DECL_REGEX)) {
      exported.add(match[1]);
    }
    for (const match of content.matchAll(EXPORT_LIST_REGEX)) {
      for (const part of match[1].split(',')) {
        const cleaned = part.trim().replace(/^type\s+/, '');
        if (!cleaned) {
          continue;
        }
        const aliasParts = cleaned.split(/\s+as\s+/);
        const target = (aliasParts[1] ?? aliasParts[0]).trim();
        if (target) {
          exported.add(target);
        }
      }
    }
    if (/export\s+default\b/.test(content)) {
      exported.add('default');
    }
    return exported;
  }

  static #parseImportedClause(clause?: string): ImportedSymbolSet {
    if (!clause) {
      return '*';
    }
    const trimmed = clause.trim();
    if (!trimmed || trimmed.startsWith('*')) {
      return '*';
    }
    const symbols = new Set<string>();
    const braceStart = trimmed.indexOf('{');
    if (braceStart > 0) {
      const defaultName = trimmed.slice(0, braceStart).replace(',', '').trim();
      if (defaultName) {
        symbols.add('default');
      }
    } else if (braceStart === -1) {
      symbols.add('default');
      return symbols;
    }

    const braceMatch = trimmed.match(/\{([^}]*)\}/);
    if (braceMatch) {
      for (const part of braceMatch[1].split(',')) {
        const cleaned = part.trim().replace(/^type\s+/, '');
        if (!cleaned) {
          continue;
        }
        const name = cleaned.split(/\s+as\s+/)[0].trim();
        if (name) {
          symbols.add(name);
        }
      }
    }
    return symbols.size > 0 ? symbols : '*';
  }

  /**
   * Extract module specifiers and imported symbol sets from source text
   */
  static extractImports(content: string): Map<string, ImportedSymbolSet> {
    const imports = new Map<string, ImportedSymbolSet>();
    for (const match of content.matchAll(IMPORT_EXPORT_REGEX)) {
      const specifier = match[2] ?? match[3];
      if (!specifier) {
        continue;
      }
      const parsed: ImportedSymbolSet = match[3] ? '*' : this.#parseImportedClause(match[1]);
      const existing = imports.get(specifier);
      if (existing === '*' || parsed === '*') {
        imports.set(specifier, '*');
      } else if (existing) {
        for (const symbol of parsed) {
          existing.add(symbol);
        }
      } else {
        imports.set(specifier, parsed);
      }
    }
    return imports;
  }

  /**
   * Extract module specifiers from source text without invoking the TypeScript compiler
   */
  static extractSpecifiers(content: string): string[] {
    return [...this.extractImports(content).keys()];
  }

  #resolveSpecifier(specifier: string, fromSourceFile: string): IndexedFile | undefined {
    let entry: IndexedFile | undefined;
    if (specifier.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fromSourceFile), specifier);
      entry =
        this.#index.getEntry(resolved) ??
        this.#index.getEntry(`${resolved}.ts`) ??
        this.#index.getEntry(`${resolved}/__index__.ts`);
    } else {
      entry = this.#index.getFromImport(specifier) ?? this.#index.getFromImport(`${specifier}/__index__`);
    }

    if (!entry || entry.sourceFile === fromSourceFile) {
      return undefined;
    }

    const module = this.#index.getModule(entry.module);
    return module?.workspace ? entry : undefined;
  }

  #isBarrel(sourceFile: string): boolean {
    return sourceFile.endsWith('/__index__.ts') || sourceFile.endsWith('/__index__.js');
  }

  #matchesBarrelSymbols(importer: string, barrel: string, barrelSymbols?: Set<string>): boolean {
    if (!barrelSymbols || barrelSymbols.size === 0) {
      return true;
    }
    const imported = this.#importedSymbols.get(importer)?.get(barrel);
    if (!imported || imported === '*') {
      return true;
    }
    for (const symbol of imported) {
      if (barrelSymbols.has(symbol)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Build the initial import graph for all workspace TypeScript/JavaScript files
   */
  async init(): Promise<void> {
    const files = this.#index.find({
      module: module => !!module.workspace,
      file: file => file.type === 'ts' || file.type === 'js'
    });
    await Promise.all(files.map(file => this.updateFile(file.sourceFile)));
  }

  /**
   * Remove a source file and its outgoing dependency edges from the graph
   */
  removeFile(sourceFile: string): void {
    const previous = this.#dependencies.get(sourceFile);
    if (previous) {
      for (const dependency of previous) {
        this.#importers.get(dependency)?.delete(sourceFile);
      }
      this.#dependencies.delete(sourceFile);
    }
    this.#exports.delete(sourceFile);
    this.#importedSymbols.delete(sourceFile);
  }

  /**
   * Re-read a source file's text and refresh its dependency edges
   */
  async updateFile(sourceFile: string): Promise<void> {
    this.removeFile(sourceFile);

    let content: string;
    try {
      content = await fs.readFile(sourceFile, 'utf8');
    } catch {
      return;
    }

    this.#exports.set(sourceFile, TestImpactGraph.extractExports(content));
    const symbolMap = new Map<string, ImportedSymbolSet>();
    const next = new Set<string>();

    for (const [specifier, symbols] of TestImpactGraph.extractImports(content)) {
      const resolved = this.#resolveSpecifier(specifier, sourceFile);
      if (resolved) {
        next.add(resolved.sourceFile);
        this.#importers.getOrInsert(resolved.sourceFile, new Set()).add(sourceFile);
        const existing = symbolMap.get(resolved.sourceFile);
        if (existing === '*' || symbols === '*') {
          symbolMap.set(resolved.sourceFile, '*');
        } else if (existing) {
          for (const symbol of symbols) {
            existing.add(symbol);
          }
        } else {
          symbolMap.set(resolved.sourceFile, new Set(symbols));
        }
      }
    }
    this.#dependencies.set(sourceFile, next);
    this.#importedSymbols.set(sourceFile, symbolMap);
  }

  /**
   * Find all test files that could be impacted by a change to sourceFile within maxDepth hops, ordered by depth then failure recency
   */
  getImpactedTests(sourceFile: string, maxDepth = 3): IndexedFile[] {
    const visited = new Set<string>([sourceFile]);
    const queue: [file: string, depth: number, barrelSymbols?: Set<string>][] = [[sourceFile, 0]];
    const impacted: { entry: IndexedFile; depth: number }[] = [];

    while (queue.length > 0) {
      const [current, depth, barrelSymbols] = queue.shift()!;
      const entry = this.#index.getEntry(current);
      if (entry && entry.role === 'test' && (entry.type === 'ts' || entry.type === 'js')) {
        impacted.push({ entry, depth });
      }

      if (depth >= maxDepth) {
        continue;
      }

      const currentIsBarrel = this.#isBarrel(current);
      for (const importer of this.#importers.get(current) ?? []) {
        if (visited.has(importer)) {
          continue;
        }
        if (currentIsBarrel && !this.#matchesBarrelSymbols(importer, current, barrelSymbols)) {
          continue;
        }
        visited.add(importer);
        const nextBarrelSymbols = this.#isBarrel(importer) ? this.#exports.get(current) : undefined;
        queue.push([importer, depth + 1, nextBarrelSymbols]);
      }
    }

    return impacted
      .sort((a, b) => a.depth - b.depth || this.#getFailureRank(b.entry.import) - this.#getFailureRank(a.entry.import))
      .map(item => item.entry);
  }
}
