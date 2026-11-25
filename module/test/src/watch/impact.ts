import fsSync from 'node:fs';
import fs from 'node:fs/promises';

import type { CompilerChangeEvent } from '@travetto/compiler';
import { type ManifestIndex, ManifestModuleUtil, path } from '@travetto/manifest';
import { JSONUtil, Runtime, RuntimeIndex, TypedObject } from '@travetto/runtime';

import type { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { DelegatingConsumer } from '../consumer/types/delegating.ts';
import type { TestEvent, TestRemoveEvent } from '../model/event.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';
import { type PersistedImportTrace, TestExecutionTracer } from './tracer.ts';

const SOURCE_TYPES = new Set(['ts', 'js']);

type TestKey = `${string}#${string}`;

type TrackedTestMetadata = {
  import: string;
  classId: string;
  methodName: string;
  module?: string;
};

/**
 * Per-test-key runtime coverage cache and delegating test consumer for resolving impacted tests
 */
export class TestImpactGraph extends DelegatingConsumer {
  #index: ManifestIndex;
  #target?: CumulativeSummaryConsumer;
  #keyMetadata = new Map<TestKey, TrackedTestMetadata>();
  #keyToSources = new Map<TestKey, Set<string>>();
  #sourceToKeys = new Map<string, Set<TestKey>>();
  #warmedImports = new Set<string>();
  #failingByImport = new Map<string, Set<TestKey>>();
  #lastFailed = new Map<string, number>();
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

  #applyImportTrace(payload: PersistedImportTrace): void {
    const testEntry = this.#index.getFromImport(payload.import);
    if (!testEntry) {
      return;
    }
    const workspacePath = this.#index.manifest.workspace.path;
    const moduleName = payload.module ?? testEntry.module;
    if (Object.keys(payload.tests).length > 0) {
      this.#warmedImports.add(payload.import);
    }

    for (const [keyString, entry] of TypedObject.entries(payload.tests)) {
      const key = keyString as TestKey;
      const previous = this.#keyToSources.get(key);
      if (previous) {
        for (const sourceFile of previous) {
          this.#sourceToKeys.get(sourceFile)?.delete(key);
        }
      }

      const validSources = new Set<string>();
      for (const relativeSource of entry.sources) {
        const absoluteSource = path.resolve(workspacePath, relativeSource);
        if (this.#index.getEntry(absoluteSource)) {
          validSources.add(absoluteSource);
          this.#sourceToKeys.getOrInsert(absoluteSource, new Set()).add(key);
        }
      }

      this.#keyMetadata.set(key, {
        import: payload.import,
        classId: entry.classId,
        methodName: entry.methodName,
        module: moduleName
      });
      this.#keyToSources.set(key, validSources);
    }
  }

  #loadImportCache(importName: string): void {
    const traceFile = TestExecutionTracer.getTraceFile(this.#index, importName);
    if (!traceFile) {
      return;
    }
    try {
      const parsed = JSONUtil.fromUTF8<PersistedImportTrace>(fsSync.readFileSync(traceFile, 'utf8'));
      if (parsed?.version === 1 && parsed.tests) {
        this.#applyImportTrace(parsed);
      }
    } catch {
      // No trace file on disk yet
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
      return;
    }
    for (const [key, metadata] of this.#keyMetadata.entries()) {
      if (metadata.import === importName && (!classId || metadata.classId === classId)) {
        this.#removeKey(key);
      }
    }
    if (!classId) {
      this.#warmedImports.delete(importName);
      this.#failingByImport.delete(importName);
      this.#lastFailed.delete(importName);
      const traceFile = TestExecutionTracer.getTraceFile(this.#index, importName);
      if (traceFile) {
        void fs.rm(traceFile, { force: true }).catch(() => {});
      }
    }
  }

  #removeSourceFile(sourceFile: string): void {
    const keys = this.#sourceToKeys.get(sourceFile);
    if (keys) {
      for (const key of keys) {
        this.#keyToSources.get(key)?.delete(sourceFile);
      }
      this.#sourceToKeys.delete(sourceFile);
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

    if (changedModule && !hasSameModuleRun) {
      const moduleTests = this.#index.find({
        module: module => module.name === changedModule,
        folder: folder => folder === 'test',
        file: file => file.role === 'test' && SOURCE_TYPES.has(file.type)
      });
      for (const testEntry of moduleTests) {
        if (testEntry.import !== deletedImport && testEntry.import !== selfTestImport && !this.#warmedImports.has(testEntry.import)) {
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
   * Load all persisted per-import trace files inline with test output files
   */
  async loadCache(): Promise<void> {
    const testEntries = this.#index.find({
      module: module => !!module.workspace,
      folder: folder => folder === 'test',
      file: file => file.role === 'test' && SOURCE_TYPES.has(file.type)
    });

    await Promise.all(
      testEntries.map(async testEntry => {
        const traceFile = TestExecutionTracer.getTraceFile(this.#index, testEntry.import);
        if (!traceFile) {
          return;
        }
        try {
          const parsed = JSONUtil.fromUTF8<PersistedImportTrace>(await fs.readFile(traceFile, 'utf8'));
          if (parsed?.version === 1 && parsed.tests) {
            this.#applyImportTrace(parsed);
          }
        } catch {
          // No trace file on disk yet
        }
      })
    );
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
      this.#loadImportCache(event.suite.import);
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
