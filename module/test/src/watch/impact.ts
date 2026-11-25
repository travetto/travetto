import fs from 'node:fs/promises';

import type { CompilerChangeEvent } from '@travetto/compiler';
import { type ManifestIndex, ManifestModuleUtil, path } from '@travetto/manifest';
import { JSONUtil, Runtime, RuntimeIndex, TypedObject } from '@travetto/runtime';

import type { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { DelegatingConsumer } from '../consumer/types/delegating.ts';
import type { TestEvent, TestRemoveEvent } from '../model/event.ts';
import type { TestDiffInput, TestResult, TestRun } from '../model/test.ts';

const SOURCE_TYPES = new Set(['ts', 'js']);
const FLUSH_DEBOUNCE_MILLIS = 250;

type TestKey = `${string}#${string}`;

type TrackedTestMetadata = {
  import: string;
  classId: string;
  methodName: string;
  module?: string;
};

type PersistedImpactCache = {
  version: 1;
  files: string[];
  warmedModules: string[];
  tests: Record<TestKey, TrackedTestMetadata & { sources: number[] }>;
};

/**
 * Per-test-key runtime coverage cache and delegating test consumer for resolving impacted tests
 */
export class TestImpactGraph extends DelegatingConsumer {
  #index: ManifestIndex;
  #target?: CumulativeSummaryConsumer;
  #cacheFile?: string;
  #flushTimer?: ReturnType<typeof setTimeout>;
  #keyMetadata = new Map<TestKey, TrackedTestMetadata>();
  #keyToSources = new Map<TestKey, Set<string>>();
  #sourceToKeys = new Map<string, Set<TestKey>>();
  #warmedModules = new Set<string>();
  #failingByImport = new Map<string, Set<TestKey>>();
  #lastFailed = new Map<string, number>();
  #failureSequence = 0;

  constructor(target?: CumulativeSummaryConsumer, index: ManifestIndex = RuntimeIndex, cacheFile?: string) {
    super(target ? [target] : []);
    this.#target = target;
    this.#index = index;
    this.#cacheFile = cacheFile;
  }

  #scheduleFlush(): void {
    if (!this.#cacheFile) {
      return;
    }
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
    }
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = undefined;
      void this.flushCache();
    }, FLUSH_DEBOUNCE_MILLIS);
    this.#flushTimer.unref();
  }

  #getFailureRank(importName: string): number {
    const sequence = this.#lastFailed.get(importName) ?? 0;
    return (this.#failingByImport.get(importName)?.size ? 1_000_000_000 : 0) + sequence;
  }

  #recordTrace(test: TestResult, coveredFiles: string[]): void {
    const key: TestKey = `${test.classId}#${test.methodName}`;
    const entry = this.#index.getFromImport(test.import);
    const moduleName = entry?.module ?? this.#index.findModuleForArbitraryImport(test.import)?.name;

    this.#keyMetadata.set(key, {
      import: test.import,
      classId: test.classId,
      methodName: test.methodName,
      module: moduleName
    });

    if (moduleName) {
      this.#warmedModules.add(moduleName);
    }

    if (test.status === 'passed') {
      const previous = this.#keyToSources.get(key);
      if (previous) {
        for (const sourceFile of previous) {
          this.#sourceToKeys.get(sourceFile)?.delete(key);
        }
      }
      const next = new Set(coveredFiles);
      this.#keyToSources.set(key, next);
      for (const sourceFile of next) {
        this.#sourceToKeys.getOrInsert(sourceFile, new Set()).add(key);
      }
      this.#scheduleFlush();
    } else if (test.status === 'failed' || test.status === 'errored') {
      const existing = this.#keyToSources.getOrInsert(key, new Set());
      for (const sourceFile of coveredFiles) {
        existing.add(sourceFile);
        this.#sourceToKeys.getOrInsert(sourceFile, new Set()).add(key);
      }
      this.#scheduleFlush();
    }
  }

  #removeKey(key: TestKey): void {
    const metadata = this.#keyMetadata.get(key);
    const sources = this.#keyToSources.get(key);
    if (sources) {
      for (const sourceFile of sources) {
        this.#sourceToKeys.get(sourceFile)?.delete(key);
      }
      this.#keyToSources.delete(key);
    }
    this.#keyMetadata.delete(key);

    if (metadata) {
      const failing = this.#failingByImport.get(metadata.import);
      if (failing) {
        failing.delete(key);
        if (failing.size === 0) {
          this.#failingByImport.delete(metadata.import);
        }
      }
    }
  }

  #clearTests(importName: string, classId?: string, methodName?: string): void {
    if (classId && methodName) {
      this.#removeKey(`${classId}#${methodName}`);
      this.#scheduleFlush();
      return;
    }
    for (const [key, metadata] of this.#keyMetadata.entries()) {
      if (metadata.import === importName && (!classId || metadata.classId === classId)) {
        this.#removeKey(key);
      }
    }
    if (!classId) {
      this.#failingByImport.delete(importName);
      this.#lastFailed.delete(importName);
    }
    this.#scheduleFlush();
  }

  #removeSourceFile(sourceFile: string): void {
    const keys = this.#sourceToKeys.get(sourceFile);
    if (keys) {
      for (const key of keys) {
        this.#keyToSources.get(key)?.delete(sourceFile);
      }
      this.#sourceToKeys.delete(sourceFile);
      this.#scheduleFlush();
    }
  }

  #getImpactedRuns(sourceFile: string, changedModule?: string, deletedImport?: string): (TestRun | TestDiffInput)[] {
    const rankedRuns: { run: TestRun | TestDiffInput; depth: number }[] = [];
    const entry = this.#index.getEntry(sourceFile);
    const isSelfTest = entry?.role === 'test' && SOURCE_TYPES.has(entry.type);
    const selfTestImport = isSelfTest ? entry.import : undefined;

    if (selfTestImport && selfTestImport !== deletedImport) {
      rankedRuns.push({
        depth: 0,
        run: this.#target
          ? { import: selfTestImport, diffSource: this.#target.produceDiffSource(selfTestImport) }
          : { import: selfTestImport }
      });
    }

    const groupedBySuite = new Map<string, { import: string; classId: string; methods: Set<string>; depth: number }>();
    for (const key of this.#sourceToKeys.get(sourceFile) ?? []) {
      const metadata = this.#keyMetadata.get(key);
      if (!metadata || metadata.import === deletedImport || metadata.import === selfTestImport) {
        continue;
      }
      const suiteKey = `${metadata.import}::${metadata.classId}`;
      const depth = changedModule && metadata.module === changedModule ? 1 : 2;
      const group = groupedBySuite.getOrInsert(suiteKey, {
        import: metadata.import,
        classId: metadata.classId,
        methods: new Set(),
        depth
      });
      group.methods.add(metadata.methodName);
    }

    let hasSameModuleRun = isSelfTest;
    for (const group of groupedBySuite.values()) {
      if (group.depth === 1) {
        hasSameModuleRun = true;
      }
      rankedRuns.push({
        depth: group.depth,
        run: { import: group.import, classId: group.classId, methodNames: [...group.methods] }
      });
    }

    if (changedModule && !hasSameModuleRun && !this.#warmedModules.has(changedModule)) {
      this.#warmedModules.add(changedModule);
      this.#scheduleFlush();
      const moduleTests = this.#index.find({
        module: module => module.name === changedModule,
        folder: folder => folder === 'test',
        file: file => file.role === 'test' && SOURCE_TYPES.has(file.type)
      });
      for (const testEntry of moduleTests) {
        if (testEntry.import !== deletedImport && testEntry.import !== selfTestImport) {
          rankedRuns.push({ depth: 1, run: { import: testEntry.import } });
        }
      }
    }

    return rankedRuns
      .sort((a, b) => a.depth - b.depth || this.#getFailureRank(b.run.import) - this.#getFailureRank(a.run.import))
      .map(item => item.run);
  }

  #onFileDelete(event: CompilerChangeEvent, sourceFile: string, isTest: boolean, moduleName?: string): (TestRun | TestDiffInput)[] {
    const runs = this.#getImpactedRuns(sourceFile, moduleName, event.import);
    this.#removeSourceFile(sourceFile);
    if (isTest) {
      this.#clearTests(event.import);
      this.#target?.removeTest(event.import);
    }
    return runs;
  }

  #onFileUpdate(event: CompilerChangeEvent, sourceFile: string, isTest: boolean, moduleName?: string): (TestRun | TestDiffInput)[] {
    const runs = this.#getImpactedRuns(sourceFile, moduleName);
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

  /**
   * Load persisted test-impact callgraph from disk, pruning missing files and tests
   */
  async loadCache(): Promise<void> {
    if (!this.#cacheFile) {
      return;
    }
    let parsed: PersistedImpactCache;
    try {
      parsed = JSONUtil.fromUTF8<PersistedImpactCache>(await fs.readFile(this.#cacheFile, 'utf8'));
    } catch {
      return;
    }

    if (parsed?.version !== 1 || !Array.isArray(parsed.files) || !parsed.tests) {
      return;
    }

    const workspacePath = this.#index.manifest.workspace.path;
    const resolvedFiles = parsed.files.map(relativeFile => {
      const absoluteFile = path.resolve(workspacePath, relativeFile);
      return this.#index.getEntry(absoluteFile) ? absoluteFile : undefined;
    });

    for (const moduleName of parsed.warmedModules ?? []) {
      if (this.#index.getModule(moduleName)?.workspace) {
        this.#warmedModules.add(moduleName);
      }
    }

    for (const [key, entry] of TypedObject.entries(parsed.tests)) {
      const testEntry = this.#index.getFromImport(entry.import);
      if (!testEntry) {
        continue;
      }
      const validSources = new Set<string>();
      for (const fileIndex of entry.sources) {
        const resolved = resolvedFiles[fileIndex];
        if (resolved) {
          validSources.add(resolved);
        }
      }
      this.#keyMetadata.set(key, {
        import: entry.import,
        classId: entry.classId,
        methodName: entry.methodName,
        module: entry.module ?? testEntry.module
      });
      this.#keyToSources.set(key, validSources);
      for (const sourceFile of validSources) {
        this.#sourceToKeys.getOrInsert(sourceFile, new Set()).add(key);
      }
    }
  }

  /**
   * Atomically persist the current test-impact callgraph to disk
   */
  async flushCache(): Promise<void> {
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = undefined;
    }
    if (!this.#cacheFile) {
      return;
    }

    const workspacePath = this.#index.manifest.workspace.path;
    const fileIndexBySource = new Map<string, number>();
    const files: string[] = [];
    const tests: PersistedImpactCache['tests'] = {};

    for (const [key, metadata] of this.#keyMetadata.entries()) {
      const sourceSet = this.#keyToSources.get(key);
      if (!sourceSet) {
        continue;
      }
      const sourceIndices: number[] = [];
      for (const sourceFile of sourceSet) {
        let index = fileIndexBySource.get(sourceFile);
        if (index === undefined) {
          index = files.length;
          files.push(path.relative(workspacePath, sourceFile));
          fileIndexBySource.set(sourceFile, index);
        }
        sourceIndices.push(index);
      }
      tests[key] = { ...metadata, sources: sourceIndices };
    }

    const payload: PersistedImpactCache = {
      version: 1,
      files,
      warmedModules: [...this.#warmedModules],
      tests
    };

    const tempFile = `${this.#cacheFile}.${process.pid}.tmp`;
    try {
      await fs.mkdir(path.dirname(this.#cacheFile), { recursive: true });
      await fs.writeFile(tempFile, JSONUtil.toUTF8(payload), 'utf8');
      await fs.rename(tempFile, this.#cacheFile);
    } catch {
      try {
        await fs.rm(tempFile, { force: true });
      } catch {
        // Ignore cleanup failure
      }
    }
  }

  transform(event: TestEvent): TestEvent {
    if (event.type === 'test' && event.phase === 'after') {
      const { coveredFiles, ...cleanTest } = event.test;
      const key: TestKey = `${cleanTest.classId}#${cleanTest.methodName}`;
      if (cleanTest.status === 'failed' || cleanTest.status === 'errored') {
        this.#failingByImport.getOrInsert(cleanTest.import, new Set()).add(key);
        this.#lastFailed.set(cleanTest.import, (this.#failureSequence += 1));
      } else {
        const failing = this.#failingByImport.get(cleanTest.import);
        if (failing) {
          failing.delete(key);
          if (failing.size === 0) {
            this.#failingByImport.delete(cleanTest.import);
          }
        }
      }
      if (coveredFiles) {
        this.#recordTrace(cleanTest, coveredFiles);
      }
      return { ...event, test: cleanTest };
    }
    return event;
  }

  transformRemove(event: TestRemoveEvent): TestRemoveEvent {
    this.#clearTests(event.import, event.classId, event.methodName);
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
    const isTest = entry?.role === 'test';
    const moduleName = entry?.module ?? this.#index.findModuleForArbitraryImport(event.import)?.name;

    return event.action === 'delete'
      ? this.#onFileDelete(event, sourceFile, isTest, moduleName)
      : this.#onFileUpdate(event, sourceFile, isTest, moduleName);
  }
}
