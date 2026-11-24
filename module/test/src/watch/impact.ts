import fsSync from 'node:fs';
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
  #watchedDependencies = new Map<string, Set<string>>();
  #fileToTests = new Map<string, Set<string>>();
  #fileToBarrels = new Map<string, Set<string>>();
  #barrelToTests = new Map<string, Map<string, ImportedSymbolSet>>();
  #failingTests = new Map<string, Set<string>>();
  #lastFailed = new Map<string, number>();
  #failureSequence = 0;

  constructor(target?: CumulativeSummaryConsumer, index: ManifestIndex = RuntimeIndex) {
    super(target ? [target] : []);
    this.#target = target;
    this.#index = index;
  }

  #matchesBarrelSymbols(imported: ImportedSymbolSet | undefined, exportedSymbols: Set<string>): boolean {
    if (exportedSymbols.size === 0 || !imported || imported === '*') {
      return true;
    }
    for (const symbol of imported) {
      if (exportedSymbols.has(symbol)) {
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

  #readExportedSymbols(sourceFile: string): Set<string> {
    try {
      return TestImpactUtil.extractExports(fsSync.readFileSync(sourceFile, 'utf8'));
    } catch {
      return new Set();
    }
  }

  #getImpactedRuns(sourceFile: string, exportedSymbols?: Set<string>, deletedImport?: string): (TestRun | TestDiffInput)[] {
    const runs: (TestRun | TestDiffInput)[] = [];
    for (const testEntry of this.getImpactedTests(sourceFile, exportedSymbols)) {
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
    const runs = this.#getImpactedRuns(sourceFile, new Set(), event.import);
    this.removeFile(sourceFile);
    if (isTest) {
      this.#clearFailures(event.import);
      this.#target?.removeTest(event.import);
    }
    return runs;
  }

  async #onFileUpdate(event: CompilerChangeEvent, sourceFile: string, isTest: boolean): Promise<(TestRun | TestDiffInput)[]> {
    const isBarrel = TestImpactUtil.isBarrel(sourceFile);
    let exportedSymbols: Set<string> | undefined;
    if (isTest || isBarrel) {
      await this.updateFile(sourceFile);
    } else {
      try {
        exportedSymbols = TestImpactUtil.extractExports(await fs.readFile(sourceFile, 'utf8'));
      } catch {
        exportedSymbols = new Set();
      }
    }

    const runs = this.#getImpactedRuns(sourceFile, exportedSymbols);
    const isDoc = event.file.startsWith('doc/') || event.file.includes('/doc/');
    if (runs.length === 0 && !isDoc && (isTest || ManifestModuleUtil.getFileRole(event.file) === 'test' || event.file.includes('/test/'))) {
      runs.push(
        this.#target ? { import: event.import, diffSource: this.#target.produceDiffSource(event.import) } : { import: event.import }
      );
    }
    return runs;
  }

  #refreshIndexIfNeeded(event: CompilerChangeEvent): void {
    if (event.action === 'create' || (event.action === 'update' && !this.#index.getFromImport(event.import))) {
      try {
        this.#index.reinitForModule(this.#index.manifest.main.name);
      } catch {
        // Ignore in-memory test manifests without a disk file
      }
    }
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
   * Build the initial import map for workspace test and barrel files only
   */
  async init(): Promise<void> {
    const files = this.#index.find({
      module: module => !!module.workspace,
      folder: folder => folder === '$index' || folder === 'test',
      file: file => SOURCE_TYPES.has(file.type) && (file.role === 'test' || TestImpactUtil.isBarrel(file.sourceFile))
    });
    await Promise.all(files.map(file => this.updateFile(file.sourceFile)));
  }

  /**
   * Remove a test or barrel file and its tracked outgoing edges
   */
  removeFile(sourceFile: string): void {
    const previous = this.#watchedDependencies.get(sourceFile);
    if (previous) {
      for (const dependency of previous) {
        this.#fileToTests.get(dependency)?.delete(sourceFile);
        this.#fileToBarrels.get(dependency)?.delete(sourceFile);
        this.#barrelToTests.get(dependency)?.delete(sourceFile);
      }
      this.#watchedDependencies.delete(sourceFile);
    }
  }

  /**
   * Re-read a test or barrel file and refresh its dependency edges
   */
  async updateFile(sourceFile: string): Promise<void> {
    this.removeFile(sourceFile);

    let content: string;
    try {
      content = await fs.readFile(sourceFile, 'utf8');
    } catch {
      return;
    }

    const isBarrel = TestImpactUtil.isBarrel(sourceFile);
    const next = new Set<string>();

    for (const [specifier, symbols] of TestImpactUtil.extractImports(content)) {
      const resolved = TestImpactUtil.resolveSpecifier(this.#index, specifier, sourceFile);
      if (!resolved) {
        continue;
      }
      next.add(resolved.sourceFile);

      if (isBarrel) {
        this.#fileToBarrels.getOrInsert(resolved.sourceFile, new Set()).add(sourceFile);
      } else if (TestImpactUtil.isBarrel(resolved.sourceFile)) {
        const testImports = this.#barrelToTests.getOrInsert(resolved.sourceFile, new Map());
        const existing = testImports.get(sourceFile);
        if (existing === '*' || symbols === '*') {
          testImports.set(sourceFile, '*');
        } else if (existing) {
          for (const symbol of symbols) {
            existing.add(symbol);
          }
        } else {
          testImports.set(sourceFile, new Set(symbols));
        }
      } else {
        this.#fileToTests.getOrInsert(resolved.sourceFile, new Set()).add(sourceFile);
      }
    }

    this.#watchedDependencies.set(sourceFile, next);
  }

  /**
   * Find test files directly importing sourceFile or importing matching symbols from its barrel
   */
  getImpactedTests(sourceFile: string, exportedSymbols?: Set<string>): IndexedFile[] {
    const impacted = new Map<string, { entry: IndexedFile; depth: number }>();

    const addIfTest = (file: string, depth: number): void => {
      if (impacted.has(file)) {
        return;
      }
      const entry = this.#index.getEntry(file);
      if (entry && entry.role === 'test' && SOURCE_TYPES.has(entry.type)) {
        impacted.set(file, { entry, depth });
      }
    };

    addIfTest(sourceFile, 0);

    for (const testFile of this.#fileToTests.get(sourceFile) ?? []) {
      addIfTest(testFile, 1);
    }

    const barrels = this.#fileToBarrels.get(sourceFile);
    if (barrels?.size) {
      const symbols = exportedSymbols ?? this.#readExportedSymbols(sourceFile);
      for (const barrelFile of barrels) {
        for (const [testFile, importedSymbols] of this.#barrelToTests.get(barrelFile) ?? []) {
          if (this.#matchesBarrelSymbols(importedSymbols, symbols)) {
            addIfTest(testFile, 1);
          }
        }
      }
    }

    return [...impacted.values()]
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

    this.#refreshIndexIfNeeded(event);
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
