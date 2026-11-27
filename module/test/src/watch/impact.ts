import fs from 'node:fs/promises';

import type { CompilerChangeEvent } from '@travetto/compiler';
import { type IndexedFile, type ManifestIndex, ManifestModuleUtil, path } from '@travetto/manifest';
import { Runtime, RuntimeIndex } from '@travetto/runtime';

import type { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { TestDurationCache } from '../execute/duration.ts';
import { RunUtil } from '../execute/run.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';

const SOURCE_TYPES = new Set(['ts', 'js']);
const SLOW_DOWNSTREAM_THRESHOLD_MILLISECONDS = 100;
const MAX_DOWNSTREAM_TESTS = 10;
const IMPORT_REGEX = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

type DownstreamCandidate = { importName: string; tier: number; duration?: number; failing: boolean };

/**
 * Lazy same-module ESM reverse-import graph and bounded downstream test impact resolver
 */
export class TestImpactGraph {
  #index: ManifestIndex;
  #summary?: CumulativeSummaryConsumer;
  #durations: TestDurationCache;
  #importsByModule = new Map<string, Map<string, Set<string>>>();
  #runnableSuiteCache = new Map<string, boolean>();

  constructor(summary?: CumulativeSummaryConsumer, index: ManifestIndex = RuntimeIndex, durations = new TestDurationCache(index)) {
    this.#summary = summary;
    this.#index = index;
    this.#durations = durations;
  }

  async #isRunnableSuite(entry?: IndexedFile): Promise<boolean> {
    if (!entry || entry.role !== 'test' || !entry.relativeFile.startsWith('test/') || !SOURCE_TYPES.has(entry.type)) {
      return false;
    }
    const cached = this.#runnableSuiteCache.get(entry.sourceFile);
    if (cached !== undefined) {
      return cached;
    }
    let runnable = false;
    try {
      runnable = await RunUtil.isTestFile(entry.sourceFile);
    } catch {
      runnable = false;
    }
    this.#runnableSuiteCache.set(entry.sourceFile, runnable);
    return runnable;
  }

  #resolveSameModuleTarget(moduleName: string, outputFile: string, specifier: string): IndexedFile | undefined {
    let target: IndexedFile | undefined;
    if (specifier.startsWith('.')) {
      target = this.#index.getEntry(path.resolve(path.dirname(outputFile), specifier));
    } else if (specifier === moduleName || specifier.startsWith(`${moduleName}/`)) {
      target =
        this.#index.getFromImport(specifier) ??
        this.#index.getFromImport(`${specifier}/__index__.ts`) ??
        this.#index.getFromImport(`${specifier}/src/index.ts`);
    }
    return target?.module === moduleName ? target : undefined;
  }

  async #indexOutputFile(moduleName: string, sourceFile: string, outputFile?: string): Promise<void> {
    const moduleImports = this.#importsByModule.get(moduleName);
    if (!outputFile || !moduleImports) {
      return;
    }
    try {
      const content = await fs.readFile(outputFile, 'utf8');
      const imported = new Set<string>();
      for (const match of content.matchAll(IMPORT_REGEX)) {
        const specifier = match[1] ?? match[2];
        const target = specifier ? this.#resolveSameModuleTarget(moduleName, outputFile, specifier) : undefined;
        if (target && target.sourceFile !== sourceFile) {
          imported.add(target.sourceFile);
        }
      }
      moduleImports.set(sourceFile, imported);
    } catch {
      // Output file may not exist on disk yet
    }
  }

  async #ensureModuleIndexed(moduleName: string): Promise<void> {
    if (this.#importsByModule.has(moduleName)) {
      return;
    }
    this.#importsByModule.set(moduleName, new Map());
    const entries = this.#index.find({
      module: module => module.name === moduleName && !!module.workspace,
      file: file => file.role !== 'doc' && SOURCE_TYPES.has(file.type)
    });
    await Promise.all(entries.map(file => this.#indexOutputFile(moduleName, file.sourceFile, file.outputFile)));
  }

  async #getSameModuleImpacted(moduleName: string, sourceFile: string, excludedImport?: string): Promise<string[]> {
    const moduleImports = this.#importsByModule.get(moduleName);
    const visited = new Set<string>([sourceFile]);
    const queue = [sourceFile];
    const impacted = new Set<string>();

    while (queue.length > 0 && moduleImports) {
      const current = queue.shift()!;
      for (const [candidateFile, dependencies] of moduleImports.entries()) {
        if (!visited.has(candidateFile) && dependencies.has(current)) {
          visited.add(candidateFile);
          queue.push(candidateFile);
          const entry = this.#index.getEntry(candidateFile);
          if (entry && entry.import !== excludedImport && (await this.#isRunnableSuite(entry))) {
            impacted.add(entry.import);
          }
        }
      }
    }

    return [...impacted].sort(
      (left, right) =>
        +(this.#summary?.isFailing(right) ?? false) - +(this.#summary?.isFailing(left) ?? false) ||
        (this.#durations.get(left) ?? 0) - (this.#durations.get(right) ?? 0) ||
        left.localeCompare(right)
    );
  }

  async #getDownstreamImpacted(moduleName: string, allowDirectParentFallback: boolean, excludedImport?: string): Promise<string[]> {
    const root = this.#index.getModule(moduleName);
    if (!root) {
      return [];
    }
    const directParents = new Set(root.parents);
    const dependents = this.#index.getDependentModules(moduleName, 'parents').filter(module => module.name !== moduleName && module.workspace);
    const candidates: DownstreamCandidate[] = [];

    for (const dependent of dependents) {
      const tier = directParents.has(dependent.name) ? 1 : 2;
      for (const suite of dependent.files.test ?? []) {
        if (suite.import !== excludedImport && (await this.#isRunnableSuite(suite))) {
          candidates.push({
            importName: suite.import,
            tier,
            duration: this.#durations.get(suite.import),
            failing: this.#summary?.isFailing(suite.import) ?? false
          });
        }
      }
    }

    const isFast = (candidate: DownstreamCandidate): boolean =>
      candidate.duration !== undefined && candidate.duration < SLOW_DOWNSTREAM_THRESHOLD_MILLISECONDS;
    const rank = (candidate: DownstreamCandidate): number => (candidate.tier === 1 ? (isFast(candidate) ? 0 : 1) : 2);
    const compare = (left: DownstreamCandidate, right: DownstreamCandidate): number =>
      (allowDirectParentFallback ? rank(left) - rank(right) : left.tier - right.tier) ||
      (left.duration ?? Number.MAX_SAFE_INTEGER) - (right.duration ?? Number.MAX_SAFE_INTEGER) ||
      left.importName.localeCompare(right.importName);

    const failing = candidates.filter(candidate => candidate.failing).sort(compare);
    const nonFailing = candidates
      .filter(candidate => !candidate.failing && (isFast(candidate) || (allowDirectParentFallback && candidate.tier === 1)))
      .sort(compare)
      .slice(0, MAX_DOWNSTREAM_TESTS);

    return [...failing, ...nonFailing].map(candidate => candidate.importName);
  }

  #refreshIndexIfNeeded(event: CompilerChangeEvent): void {
    if (event.action === 'create' || event.action === 'delete' || (event.action === 'update' && !this.#index.getFromImport(event.import))) {
      try {
        this.#index.reinitForModule(this.#index.manifest.main.name);
      } catch {
        // Ignore in-memory test manifests without a disk file
      }
    }
  }

  /**
   * Handle a compiler change event and return the prioritized impacted test runs to queue
   */
  async onCompilerChange(event: CompilerChangeEvent): Promise<(TestRun | TestDiffInput)[]> {
    if (!SOURCE_TYPES.has(ManifestModuleUtil.getFileType(event.file))) {
      return [];
    }
    if (event.action !== 'delete') {
      this.#refreshIndexIfNeeded(event);
    }

    const entry = this.#index.getFromImport(event.import);
    if (entry?.role === 'doc' || event.file.startsWith('doc/') || event.file.includes('/doc/')) {
      return [];
    }

    const sourceFile = entry?.sourceFile ?? path.resolve(Runtime.workspace.path, event.file);
    const moduleName = entry?.module ?? this.#index.findModuleForArbitraryImport(event.import)?.name;
    if (!moduleName) {
      return [];
    }

    await this.#ensureModuleIndexed(moduleName);
    this.#runnableSuiteCache.delete(sourceFile);

    if (event.action !== 'delete') {
      await this.#indexOutputFile(
        moduleName,
        sourceFile,
        entry?.outputFile ?? (event.output ? path.resolve(Runtime.workspace.path, event.output) : undefined)
      );
    }

    const isRunnable = await this.#isRunnableSuite(entry);
    const isTestFolder = entry ? entry.relativeFile.startsWith('test/') : event.file.startsWith('test/') || event.file.includes('/test/');
    const isSupportTest = entry
      ? entry.relativeFile.startsWith('support/test/')
      : event.file.startsWith('support/test/') || event.file.includes('/support/test/');

    const runs: (TestRun | TestDiffInput)[] = [];
    if (isRunnable && event.action !== 'delete') {
      runs.push(this.#summary ? { import: entry!.import, diffSource: this.#summary.produceDiffSource(entry!.import) } : { import: entry!.import });
    }

    const sameModule = await this.#getSameModuleImpacted(moduleName, sourceFile, isRunnable || event.action === 'delete' ? event.import : undefined);
    runs.push(...sameModule.map(importName => ({ import: importName })));

    if (!isRunnable && !isTestFolder) {
      let ownSuiteCount = 0;
      for (const file of this.#index.getModule(moduleName)?.files.test ?? []) {
        if (file.import !== event.import && (await this.#isRunnableSuite(file))) {
          ownSuiteCount += 1;
        }
      }
      const downstream = await this.#getDownstreamImpacted(
        moduleName,
        isSupportTest || ownSuiteCount === 0,
        event.action === 'delete' ? event.import : undefined
      );
      runs.push(...downstream.map(importName => ({ import: importName })));
    }

    if (event.action === 'delete') {
      this.#importsByModule.get(moduleName)?.delete(sourceFile);
      if (isRunnable) {
        this.#durations.delete(event.import);
        this.#summary?.removeTest(event.import);
      }
      this.#refreshIndexIfNeeded(event);
    }

    return runs;
  }
}
