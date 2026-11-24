import fs from 'node:fs/promises';

import type { CompilerChangeEvent } from '@travetto/compiler';
import { type IndexedFile, type ManifestIndex, ManifestModuleUtil, path } from '@travetto/manifest';
import { Runtime, RuntimeIndex } from '@travetto/runtime';

import type { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { DelegatingConsumer } from '../consumer/types/delegating.ts';
import type { TestEvent, TestRemoveEvent } from '../model/event.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';
import { type ImportedSymbolSet, TestImpactUtil } from './impact-util.ts';

const SOURCE_TYPES = new Set(['ts', 'js']);

/**
 * Lightweight text-based import graph and delegating test consumer for resolving and prioritizing impacted tests
 */
export class TestImpactGraph extends DelegatingConsumer {

  #index: ManifestIndex;
  #target?: CumulativeSummaryConsumer;
  #dependencies = new Map<string, Set<string>>();
  #importers = new Map<string, Set<string>>();
  #exports = new Map<string, Set<string>>();
  #importedSymbols = new Map<string, Map<string, ImportedSymbolSet>>();
  #failingTests = new Map<string, Set<string>>();
  #lastFailed = new Map<string, number>();
  #failureSequence = 0;

  constructor(target?: CumulativeSummaryConsumer, index: ManifestIndex = RuntimeIndex) {
    super(target ? [target] : []);
    this.#target = target;
    this.#index = index;
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

  #getFailureRank(importName: string): number {
    const sequence = this.#lastFailed.get(importName) ?? 0;
    return (this.#failingTests.get(importName)?.size ? 1_000_000_000 : 0) + sequence;
  }

  #clearFailures(importName: string): void {
    this.#failingTests.delete(importName);
    this.#lastFailed.delete(importName);
  }

  #getImpactedRuns(sourceFile: string, deletedImport?: string): (TestRun | TestDiffInput)[] {
    const runs: (TestRun | TestDiffInput)[] = [];
    for (const testEntry of this.getImpactedTests(sourceFile)) {
      if (testEntry.import === deletedImport) {
        continue;
      }
      runs.push(
        testEntry.sourceFile === sourceFile && this.#target
          ? { import: testEntry.import, diffSource: this.#target.produceDiffSource(testEntry.import) }
          : { import: testEntry.import }
      );
    }
    return runs;
  }

  #onFileDelete(event: CompilerChangeEvent, sourceFile: string, isTest: boolean): (TestRun | TestDiffInput)[] {
    const runs = this.#getImpactedRuns(sourceFile, event.import);
    this.removeFile(sourceFile);
    if (isTest) {
      this.#clearFailures(event.import);
      this.#target?.removeTest(event.import);
    }
    return runs;
  }

  async #onFileUpdate(event: CompilerChangeEvent, sourceFile: string, isTest: boolean): Promise<(TestRun | TestDiffInput)[]> {
    await this.updateFile(sourceFile);
    const runs = this.#getImpactedRuns(sourceFile);
    const isDoc = event.file.startsWith('doc/') || event.file.includes('/doc/');
    if (runs.length === 0 && !isDoc && (isTest || ManifestModuleUtil.getFileRole(event.file) === 'test' || event.file.includes('/test/'))) {
      runs.push(
        this.#target ? { import: event.import, diffSource: this.#target.produceDiffSource(event.import) } : { import: event.import }
      );
    }
    return runs;
  }

  transform(event: TestEvent): TestEvent {
    if (event.type === 'test' && event.phase === 'after') {
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
    return event;
  }

  transformRemove(event: TestRemoveEvent): TestRemoveEvent {
    if (!event.classId && !event.methodName) {
      this.#clearFailures(event.import);
    }
    return event;
  }

  /**
   * Build the initial import graph for all workspace TypeScript/JavaScript files
   */
  async init(): Promise<void> {
    const files = this.#index.find({
      module: module => !!module.workspace,
      folder: folder => folder !== 'doc',
      file: file => SOURCE_TYPES.has(file.type) && file.role !== 'doc'
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

    this.#exports.set(sourceFile, TestImpactUtil.extractExports(content));
    const symbolMap = new Map<string, ImportedSymbolSet>();
    const next = new Set<string>();

    for (const [specifier, symbols] of TestImpactUtil.extractImports(content)) {
      const resolved = TestImpactUtil.resolveSpecifier(this.#index, specifier, sourceFile);
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
   * Find test files directly importing sourceFile or its barrel exports, ordered by depth then failure recency
   */
  getImpactedTests(sourceFile: string): IndexedFile[] {
    const visited = new Set<string>([sourceFile]);
    const queue: [file: string, depth: number, barrelSymbols?: Set<string>][] = [[sourceFile, 0]];
    const impacted: { entry: IndexedFile; depth: number }[] = [];

    while (queue.length > 0) {
      const [current, depth, barrelSymbols] = queue.shift()!;
      const entry = this.#index.getEntry(current);
      if (entry && entry.role === 'test' && SOURCE_TYPES.has(entry.type)) {
        impacted.push({ entry, depth });
      }

      const currentIsBarrel = TestImpactUtil.isBarrel(current);
      if (depth >= 1 && !currentIsBarrel) {
        continue;
      }

      for (const importer of this.#importers.get(current) ?? []) {
        if (visited.has(importer)) {
          continue;
        }
        if (currentIsBarrel && !this.#matchesBarrelSymbols(importer, current, barrelSymbols)) {
          continue;
        }
        visited.add(importer);
        const importerIsBarrel = TestImpactUtil.isBarrel(importer);
        const nextBarrelSymbols = importerIsBarrel ? this.#exports.get(current) : undefined;
        queue.push([importer, importerIsBarrel ? depth : depth + 1, nextBarrelSymbols]);
      }
    }

    return impacted
      .sort((a, b) => a.depth - b.depth || this.#getFailureRank(b.entry.import) - this.#getFailureRank(a.entry.import))
      .map(item => item.entry);
  }

  /**
   * Sort test imports by failure recency (currently failing first, then most recently failed)
   */
  onRunTests(imports: string[]): TestRun[] {
    return [...imports]
      .sort((a, b) => this.#getFailureRank(b) - this.#getFailureRank(a))
      .map(targetImport => ({ import: targetImport }));
  }

  /**
   * Handle a compiler change event and return the impacted test runs to queue
   */
  async onCompilerChange(event: CompilerChangeEvent): Promise<(TestRun | TestDiffInput)[]> {
    if (!SOURCE_TYPES.has(ManifestModuleUtil.getFileType(event.file))) {
      return [];
    }

    const entry = this.#index.getFromImport(event.import);
    if (entry?.role === 'doc' || event.file.startsWith('doc/') || event.file.includes('/doc/')) {
      return [];
    }

    const sourceFile = entry?.sourceFile ?? path.resolve(Runtime.workspace.path, event.file);
    const isTest = entry?.role === 'test';

    return event.action === 'delete'
      ? this.#onFileDelete(event, sourceFile, isTest)
      : await this.#onFileUpdate(event, sourceFile, isTest);
  }
}
