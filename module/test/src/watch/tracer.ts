import fs from 'node:fs/promises';
import inspector from 'node:inspector';
import { fileURLToPath } from 'node:url';

import { type ManifestIndex, path } from '@travetto/manifest';
import { JSONUtil, RuntimeIndex } from '@travetto/runtime';

import type { SuitesSummary, TestConsumerShape, TestRunState } from '../consumer/types.ts';
import { DelegatingConsumer } from '../consumer/types/delegating.ts';
import type { TestEvent } from '../model/event.ts';
import type { TestStatus } from '../model/test.ts';

const IGNORED_FUNCTION_NAMES = new Set(['', '<instance_members_initializer>', '<computed>']);

export type TestMethodTrace = {
  classId: string;
  methodName: string;
  status: TestStatus;
  coveredFiles: string[];
};

export type PersistedImportTrace = {
  version: 1;
  import: string;
  module?: string;
  tests: Record<
    string,
    {
      classId: string;
      methodName: string;
      sources: string[];
    }
  >;
};

/**
 * Delegating consumer that captures per-test executed workspace source files via V8 Precise Coverage
 */
export class TestExecutionTracer extends DelegatingConsumer {
  static getTraceFile(index: ManifestIndex, importName: string): string | undefined {
    const outputFile = index.getFromImport(importName)?.outputFile;
    return outputFile ? outputFile.replace(/\.js$/, '.impact.json') : undefined;
  }

  #index: ManifestIndex;
  #session?: inspector.Session;
  #importFiles?: string[];
  #sharedSuiteFiles?: string[];
  #methodTraces: TestMethodTrace[] = [];
  #pendingSaves: Promise<void>[] = [];

  constructor(target?: TestConsumerShape, index: ManifestIndex = RuntimeIndex) {
    super(target ? [target] : []);
    this.#index = index;
  }

  #resetDelta(): void {
    this.#session?.post('Profiler.takePreciseCoverage');
  }

  #collectDelta(suiteImport: string): string[] {
    if (!this.#session) {
      return [];
    }

    let result: inspector.Profiler.ScriptCoverage[] = [];
    this.#session.post('Profiler.takePreciseCoverage', (error, response) => {
      if (!error && response) {
        result = response.result;
      }
    });

    const suiteModule = this.#index.getFromImport(suiteImport)?.module ?? this.#index.findModuleForArbitraryImport(suiteImport)?.name;
    const sources = new Set<string>();

    for (const script of result) {
      if (!script.url.startsWith('file://')) {
        continue;
      }

      const hasExecutedFunction = script.functions.some(
        fn => !IGNORED_FUNCTION_NAMES.has(fn.functionName) && fn.ranges.some(range => range.count > 0)
      );
      if (!hasExecutedFunction) {
        continue;
      }

      let outputPath: string;
      try {
        outputPath = fileURLToPath(script.url);
      } catch {
        continue;
      }

      const entry = this.#index.getEntry(outputPath);
      if (!entry || entry.role === 'doc' || entry.import === suiteImport || entry.import === '@travetto/test/src/watch/tracer.ts') {
        continue;
      }
      if (entry.module === '@travetto/test' && suiteModule !== '@travetto/test') {
        continue;
      }
      if (this.#index.getModule(entry.module)?.workspace) {
        sources.add(entry.sourceFile);
      }
    }

    return [...sources];
  }

  #stop(): void {
    const session = this.#session;
    if (!session) {
      return;
    }
    this.#session = undefined;
    try {
      session.post('Profiler.stopPreciseCoverage');
      session.post('Profiler.disable');
    } catch {
      // Ignore inspector shutdown errors
    } finally {
      session.disconnect();
    }
  }

  override async onStart(state: TestRunState): Promise<void> {
    this.#ensureStarted();
    await super.onStart(state);
  }

  #ensureStarted(): void {
    if (!this.#session) {
      const session = new inspector.Session();
      session.connect();
      session.post('Profiler.enable');
      session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
      this.#session = session;
    }
  }

  override transform(event: TestEvent): TestEvent {
    if (event.type === 'suite') {
      if (event.phase === 'before') {
        if (this.#importFiles === undefined) {
          this.#importFiles = this.#session ? this.#collectDelta(event.suite.import) : [];
        }
        this.#ensureStarted();
        this.#sharedSuiteFiles = undefined;
        this.#methodTraces = [];
        this.#resetDelta();
      } else if (event.phase === 'after') {
        if (this.#methodTraces.length > 0) {
          this.#pendingSaves.push(this.saveImportTrace(event.suite.import, this.#methodTraces));
        }
        this.#stop();
      }
    } else if (event.type === 'test') {
      if (event.phase === 'before') {
        if (this.#sharedSuiteFiles === undefined) {
          this.#sharedSuiteFiles = [...new Set([...(this.#importFiles ?? []), ...this.#collectDelta(event.test.import)])];
        } else {
          this.#resetDelta();
        }
      } else if (event.phase === 'after') {
        const coveredFiles = [...new Set([...(this.#sharedSuiteFiles ?? []), ...this.#collectDelta(event.test.import)])];
        this.#methodTraces.push({
          classId: event.test.classId,
          methodName: event.test.methodName,
          status: event.test.status,
          coveredFiles
        });
      }
    }
    return event;
  }

  async onSummary(): Promise<void> {
    await this.flush();
  }

  /**
   * Merge and persist per-method traces for a test import file
   */
  async saveImportTrace(importName: string, traces: TestMethodTrace[]): Promise<void> {
    if (traces.length === 0) {
      return;
    }

    const traceFile = TestExecutionTracer.getTraceFile(this.#index, importName);
    if (!traceFile) {
      return;
    }
    const workspacePath = this.#index.manifest.workspace.path;
    const moduleName = this.#index.getFromImport(importName)?.module ?? this.#index.findModuleForArbitraryImport(importName)?.name;

    let payload: PersistedImportTrace = {
      version: 1,
      import: importName,
      module: moduleName,
      tests: {}
    };

    try {
      const existing = JSONUtil.fromUTF8<PersistedImportTrace>(await fs.readFile(traceFile, 'utf8'));
      if (existing?.version === 1 && existing.tests) {
        payload = existing;
      }
    } catch {
      // No prior trace file
    }

    for (const trace of traces) {
      const key = `${trace.classId}#${trace.methodName}`;
      const relativeSources = trace.coveredFiles.map(sourceFile => path.relative(workspacePath, sourceFile));
      if (trace.status === 'passed') {
        payload.tests[key] = {
          classId: trace.classId,
          methodName: trace.methodName,
          sources: [...new Set(relativeSources)]
        };
      } else if (trace.status === 'failed' || trace.status === 'errored') {
        const previous = payload.tests[key]?.sources ?? [];
        payload.tests[key] = {
          classId: trace.classId,
          methodName: trace.methodName,
          sources: [...new Set([...previous, ...relativeSources])]
        };
      }
    }

    const tempFile = `${traceFile}.${process.pid}.tmp`;
    try {
      await fs.mkdir(path.dirname(traceFile), { recursive: true });
      await fs.writeFile(tempFile, JSONUtil.toUTF8(payload), 'utf8');
      await fs.rename(tempFile, traceFile);
    } catch {
      try {
        await fs.rm(tempFile, { force: true });
      } catch {
        // Ignore cleanup failure
      }
    }
  }

  /**
   * Wait for any pending trace file writes and stop the inspector session
   */
  async flush(): Promise<void> {
    this.#stop();
    await Promise.all(this.#pendingSaves);
    this.#pendingSaves = [];
  }
}
