import fs from 'node:fs/promises';

import type { CompilerChangeEvent } from '@travetto/compiler';
import { type IndexedFile, type ManifestIndex, ManifestModuleUtil, path } from '@travetto/manifest';
import { Runtime, RuntimeIndex } from '@travetto/runtime';

import type { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { DelegatingConsumer } from '../consumer/types/delegating.ts';
import type { TestEvent } from '../model/event.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';

const SOURCE_TYPES = new Set(['ts', 'js']);
const SLOW_DOWNSTREAM_THRESHOLD_MILLISECONDS = 1000;
const IMPORT_REGEX = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

type TestKey = `${string}#${string}`;

/**
 * Static ESM reverse-import graph and delegating test consumer for resolving impacted tests
 */
export class TestImpactGraph extends DelegatingConsumer {
  #index: ManifestIndex;
  #target?: CumulativeSummaryConsumer;
  #importsByFile = new Map<string, Set<string>>();
  #importersByFile = new Map<string, Set<string>>();
  #failingByImport = new Map<string, Set<TestKey>>();
  #lastFailed = new Map<string, number>();
  #durationByImport = new Map<string, number>();
  #failureSequence = 0;

  constructor(target?: CumulativeSummaryConsumer, index: ManifestIndex = RuntimeIndex) {
    super(target ? [target] : []);
    this.#target = target;
    this.#index = index;
  }

  #getFailureRank(importName: string): number {
    const sequence = this.#lastFailed.get(importName) ?? 0;
    return (this.#failingByImport.get(importName)?.size ? 1_000_000_000 : 0) + sequence;
  }

  #resolveImportTarget(outputFile: string, specifier: string): IndexedFile | undefined {
    const target = specifier.startsWith('.')
      ? this.#index.getEntry(path.resolve(path.dirname(outputFile), specifier))
      : (this.#index.getFromImport(specifier) ??
        this.#index.getFromImport(`${specifier}/__index__.ts`) ??
        this.#index.getFromImport(`${specifier}/src/index.ts`));
    return target && this.#index.getModule(target.module)?.workspace ? target : undefined;
  }

  #setFileImports(sourceFile: string, importedSources: Set<string>): void {
    const previous = this.#importsByFile.get(sourceFile);
    if (previous) {
      for (const dependency of previous) {
        this.#importersByFile.get(dependency)?.delete(sourceFile);
      }
    }
    if (importedSources.size === 0) {
      this.#importsByFile.delete(sourceFile);
      return;
    }
    this.#importsByFile.set(sourceFile, importedSources);
    for (const dependency of importedSources) {
      this.#importersByFile.getOrInsert(dependency, new Set()).add(sourceFile);
    }
  }

  async #indexOutputFile(sourceFile: string, outputFile?: string): Promise<void> {
    if (!outputFile) {
      return;
    }
    try {
      const content = await fs.readFile(outputFile, 'utf8');
      const imported = new Set<string>();
      for (const match of content.matchAll(IMPORT_REGEX)) {
        const specifier = match[1] ?? match[2];
        if (!specifier) {
          continue;
        }
        const target = this.#resolveImportTarget(outputFile, specifier);
        if (target && target.sourceFile !== sourceFile) {
          imported.add(target.sourceFile);
        }
      }
      this.#setFileImports(sourceFile, imported);
    } catch {
      // Output file may not exist on disk yet
    }
  }

  #removeSourceFile(sourceFile: string): void {
    this.#setFileImports(sourceFile, new Set());
    const dependents = this.#importersByFile.get(sourceFile);
    if (dependents) {
      for (const dependent of dependents) {
        this.#importsByFile.get(dependent)?.delete(sourceFile);
      }
      this.#importersByFile.delete(sourceFile);
    }
  }

  #getModuleDepths(rootModule?: string): Map<string, number> {
    const depths = new Map<string, number>();
    if (!rootModule) {
      return depths;
    }
    const queue: [string, number][] = [[rootModule, 1]];
    while (queue.length > 0) {
      const [moduleName, depth] = queue.shift()!;
      if (depths.has(moduleName)) {
        continue;
      }
      depths.set(moduleName, depth);
      const module = this.#index.getModule(moduleName);
      if (module) {
        for (const dependent of module.parents) {
          if (!depths.has(dependent)) {
            queue.push([dependent, depth + 1]);
          }
        }
      }
    }
    return depths;
  }

  #getImpactedRuns(sourceFile: string, changedModule?: string, deletedImport?: string): (TestRun | TestDiffInput)[] {
    const rankedRuns: { run: TestRun | TestDiffInput; depth: number }[] = [];
    const seenImports = new Set<string>();
    const entry = this.#index.getEntry(sourceFile);
    const isSelfTest = entry?.role === 'test' && SOURCE_TYPES.has(entry.type);
    const selfTestImport = isSelfTest ? entry.import : undefined;
    const moduleDepths = this.#getModuleDepths(changedModule);

    if (selfTestImport && selfTestImport !== deletedImport) {
      seenImports.add(selfTestImport);
      rankedRuns.push({
        depth: 0,
        run: this.#target ? { import: selfTestImport, diffSource: this.#target.produceDiffSource(selfTestImport) } : { import: selfTestImport }
      });
    }

    const visited = new Set<string>([sourceFile]);
    const queue = [sourceFile];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const importer of this.#importersByFile.get(current) ?? []) {
        if (visited.has(importer)) {
          continue;
        }
        visited.add(importer);
        queue.push(importer);

        const importerEntry = this.#index.getEntry(importer);
        if (
          importerEntry?.role === 'test' &&
          SOURCE_TYPES.has(importerEntry.type) &&
          importerEntry.import !== deletedImport &&
          !seenImports.has(importerEntry.import)
        ) {
          seenImports.add(importerEntry.import);
          const depth = moduleDepths.get(importerEntry.module) ?? Number.MAX_SAFE_INTEGER;
          rankedRuns.push({ depth, run: { import: importerEntry.import } });
        }
      }
    }

    return rankedRuns
      .filter(
        item =>
          item.depth < 2 || (this.#durationByImport.get(item.run.import) ?? 0) < SLOW_DOWNSTREAM_THRESHOLD_MILLISECONDS
      )
      .sort(
        (a, b) =>
          a.depth - b.depth ||
          this.#getFailureRank(b.run.import) - this.#getFailureRank(a.run.import) ||
          (this.#durationByImport.get(a.run.import) ?? 0) - (this.#durationByImport.get(b.run.import) ?? 0) ||
          a.run.import.localeCompare(b.run.import)
      )
      .map(item => item.run);
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

  /**
   * Index all compiled workspace JS files into the static reverse-import graph
   */
  async loadCache(): Promise<void> {
    const entries = this.#index.find({
      module: module => !!module.workspace,
      file: file => file.role !== 'doc' && SOURCE_TYPES.has(file.type)
    });
    await Promise.all(entries.map(file => this.#indexOutputFile(file.sourceFile, file.outputFile)));
  }

  transform(event: TestEvent): TestEvent {
    if (event.type === 'test' && event.phase === 'after') {
      const { import: importName, classId, methodName, status } = event.test;
      const key: TestKey = `${classId}#${methodName}`;
      if (status === 'failed' || status === 'errored') {
        this.#failingByImport.getOrInsert(importName, new Set()).add(key);
        this.#lastFailed.set(importName, (this.#failureSequence += 1));
      } else {
        const failing = this.#failingByImport.get(importName);
        if (failing) {
          failing.delete(key);
          if (failing.size === 0) {
            this.#failingByImport.delete(importName);
          }
        }
      }
    } else if (event.type === 'suite' && event.phase === 'after') {
      this.#durationByImport.set(
        event.suite.import,
        Math.max(this.#durationByImport.get(event.suite.import) ?? 0, event.suite.duration)
      );
    }
    return event;
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
    const moduleName = entry?.module ?? this.#index.findModuleForArbitraryImport(event.import)?.name;

    if (event.action === 'delete') {
      const runs = this.#getImpactedRuns(sourceFile, moduleName, event.import);
      this.#removeSourceFile(sourceFile);
      if (entry?.role === 'test') {
        this.#failingByImport.delete(event.import);
        this.#lastFailed.delete(event.import);
        this.#durationByImport.delete(event.import);
        this.#target?.removeTest(event.import);
      }
      return runs;
    }

    await this.#indexOutputFile(sourceFile, entry?.outputFile ?? (event.output ? path.resolve(Runtime.workspace.path, event.output) : undefined));
    return this.#getImpactedRuns(sourceFile, moduleName);
  }
}
