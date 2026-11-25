import fs from 'node:fs/promises';
import inspector from 'node:inspector/promises';
import { fileURLToPath } from 'node:url';

import { type ManifestIndex, path } from '@travetto/manifest';
import { JSONUtil, RuntimeIndex } from '@travetto/runtime';

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
 * Captures per-test executed workspace source files via V8 Precise Coverage and persists per-import traces
 */
export class TestExecutionTracer {
  static getTraceFile(cacheDir: string, importName: string): string {
    return path.resolve(cacheDir, `${encodeURIComponent(importName)}.json`);
  }

  static async create(index: ManifestIndex = RuntimeIndex, cacheDir?: string): Promise<TestExecutionTracer> {
    const tracer = new TestExecutionTracer(index, cacheDir);
    await tracer.start();
    return tracer;
  }

  #index: ManifestIndex;
  #cacheDir: string;
  #session = new inspector.Session();
  #active = false;

  constructor(index: ManifestIndex = RuntimeIndex, cacheDir = path.resolve(index.outputRoot, 'test-impact')) {
    this.#index = index;
    this.#cacheDir = cacheDir;
  }

  async start(): Promise<void> {
    if (this.#active) {
      return;
    }
    this.#session.connect();
    await this.#session.post('Profiler.enable');
    await this.#session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
    this.#active = true;
  }

  async resetDelta(): Promise<void> {
    if (this.#active) {
      await this.#session.post('Profiler.takePreciseCoverage');
    }
  }

  async collectDelta(suiteImport: string): Promise<string[]> {
    if (!this.#active) {
      return [];
    }

    const { result } = await this.#session.post('Profiler.takePreciseCoverage');
    const suiteModule =
      this.#index.getFromImport(suiteImport)?.module ?? this.#index.findModuleForArbitraryImport(suiteImport)?.name;
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
      if (!entry || entry.role === 'doc' || entry.import === '@travetto/test/src/watch/tracer.ts') {
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

  /**
   * Merge and persist per-method traces for a test import file
   */
  async saveImportTrace(importName: string, traces: TestMethodTrace[]): Promise<void> {
    if (traces.length === 0) {
      return;
    }

    const traceFile = TestExecutionTracer.getTraceFile(this.#cacheDir, importName);
    const workspacePath = this.#index.manifest.workspace.path;
    const moduleName =
      this.#index.getFromImport(importName)?.module ?? this.#index.findModuleForArbitraryImport(importName)?.name;

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
      await fs.mkdir(this.#cacheDir, { recursive: true });
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

  async stop(): Promise<void> {
    if (!this.#active) {
      return;
    }
    this.#active = false;
    try {
      await this.#session.post('Profiler.stopPreciseCoverage');
      await this.#session.post('Profiler.disable');
    } catch {
      // Ignore inspector shutdown errors
    } finally {
      this.#session.disconnect();
    }
  }
}
