import inspector from 'node:inspector/promises';
import { fileURLToPath } from 'node:url';

import type { ManifestIndex } from '@travetto/manifest';
import { RuntimeIndex } from '@travetto/runtime';

const IGNORED_FUNCTION_NAMES = new Set(['', '<instance_members_initializer>', '<computed>']);

/**
 * Captures per-test executed workspace source files via V8 Precise Coverage
 */
export class TestExecutionTracer {
  static async create(index: ManifestIndex = RuntimeIndex): Promise<TestExecutionTracer> {
    const tracer = new TestExecutionTracer(index);
    await tracer.start();
    return tracer;
  }

  #index: ManifestIndex;
  #session = new inspector.Session();
  #active = false;

  constructor(index: ManifestIndex = RuntimeIndex) {
    this.#index = index;
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
