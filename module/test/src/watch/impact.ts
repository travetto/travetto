import fs from 'node:fs/promises';

import type { CompilerChangeEvent } from '@travetto/compiler';
import { type IndexedFile, type ManifestIndex, ManifestModuleUtil, path } from '@travetto/manifest';
import { RuntimeIndex } from '@travetto/runtime';

import { RunUtil } from '../execute/run.ts';
import type { TestRun } from '../model/test.ts';

const SOURCE_TYPES = new Set(['ts', 'js']);
const SLOW_DOWNSTREAM_THRESHOLD_MILLISECONDS = 100;
const MAX_DOWNSTREAM_TESTS = 10;
const IMPORT_REGEX = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

type ImpactedCandidate = { importName: string; tier: number; duration?: number; failing: boolean };
type ImpactCandidateProvider = (importName: string) => Omit<ImpactedCandidate, 'tier' | 'importName'>;

const isFastCandidate = (candidate: ImpactedCandidate): boolean =>
  candidate.duration !== undefined && candidate.duration < SLOW_DOWNSTREAM_THRESHOLD_MILLISECONDS;

const compareCandidates = (left: ImpactedCandidate, right: ImpactedCandidate): number =>
  +right.failing - +left.failing ||
  left.tier - right.tier ||
  (left.duration ?? Number.MAX_SAFE_INTEGER) - (right.duration ?? Number.MAX_SAFE_INTEGER) ||
  left.importName.localeCompare(right.importName);

/**
 * Lazy same-module ESM reverse-import graph and bounded downstream test impact resolver
 */
export class TestImpactGraph {
  #index: ManifestIndex;
  #toCandidate: ImpactCandidateProvider;
  #importsByModule = new Map<string, Map<string, Set<string>>>();

  constructor(toCandidate: ImpactCandidateProvider, index: ManifestIndex = RuntimeIndex) {
    this.#toCandidate = toCandidate;
    this.#index = index;
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

  async #indexOutputFile(moduleName: string, sourceFile: string, outputFile: string): Promise<void> {
    const moduleImports = this.#importsByModule.get(moduleName);
    if (!moduleImports) {
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
          if (entry?.import !== excludedImport && (await RunUtil.isTestEntry(entry))) {
            impacted.add(entry!.import);
          }
        }
      }
    }

    return [...impacted]
      .map(importName => ({ importName, tier: 0, ...this.#toCandidate(importName) }))
      .sort(compareCandidates)
      .map(candidate => candidate.importName);
  }

  async #getDownstreamImpacted(moduleName: string, allowDirectParentFallback: boolean, excludedImport?: string): Promise<string[]> {
    const root = this.#index.getModule(moduleName);
    if (!root) {
      return [];
    }
    const directParents = new Set(root.parents);
    const dependents = this.#index
      .getDependentModules(moduleName, 'parents')
      .filter(module => module.name !== moduleName && module.workspace);
    const candidates: ImpactedCandidate[] = [];

    for (const dependent of dependents) {
      const tier = directParents.has(dependent.name) ? 1 : 2;
      for (const suite of dependent.files.test ?? []) {
        if (excludedImport !== suite.import && (await RunUtil.isTestEntry(suite))) {
          candidates.push({ importName: suite.import, tier, ...this.#toCandidate(suite.import) });
        }
      }
    }

    let nonFailingCount = 0;
    return candidates
      .filter(candidate => candidate.failing || isFastCandidate(candidate) || (allowDirectParentFallback && candidate.tier === 1))
      .sort(compareCandidates)
      .filter(candidate => candidate.failing || ++nonFailingCount <= MAX_DOWNSTREAM_TESTS)
      .map(candidate => candidate.importName);
  }

  /**
   * Handle a compiler change event and return the prioritized impacted test runs to queue
   */
  async onCompilerChange(event: CompilerChangeEvent): Promise<TestRun[]> {
    const { module: moduleName, relativeFile } = event;
    if (
      !relativeFile ||
      !SOURCE_TYPES.has(ManifestModuleUtil.getFileType(relativeFile)) ||
      ManifestModuleUtil.getFileRole(relativeFile) === 'doc'
    ) {
      return [];
    }

    const workspacePath = this.#index.manifest.workspace.path;
    const sourceFile = path.resolve(workspacePath, event.file);
    const outputFile = path.resolve(workspacePath, event.output);

    await this.#ensureModuleIndexed(moduleName);
    RunUtil.resetFile(sourceFile);

    if (event.action !== 'delete' && event.output) {
      await this.#indexOutputFile(moduleName, sourceFile, outputFile);
    }

    const folder = ManifestModuleUtil.getFolderKey(relativeFile);
    const role = ManifestModuleUtil.getFileRole(relativeFile);
    const isRunnable = folder === 'test' && (await RunUtil.isTestFile(sourceFile));
    const sameModule = await this.#getSameModuleImpacted(
      moduleName,
      sourceFile,
      isRunnable || event.action === 'delete' ? event.import : undefined
    );

    const runs: TestRun[] = [...sameModule.map(importName => ({ import: importName }))];

    if (folder !== 'test') {
      let ownSuiteCount = 0;
      for (const file of this.#index.getModule(moduleName)?.files.test ?? []) {
        if (event.import !== file.import && (await RunUtil.isTestEntry(file))) {
          ownSuiteCount += 1;
        }
      }
      const downstream = await this.#getDownstreamImpacted(
        moduleName,
        (folder === 'support' && role === 'test') || ownSuiteCount === 0,
        event.action === 'delete' ? event.import : undefined
      );
      runs.push(...downstream.map(importName => ({ import: importName })));
    }

    return runs;
  }
}
