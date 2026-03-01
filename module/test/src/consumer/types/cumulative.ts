import type { TestConsumerShape } from '../types.ts';
import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';
import type { TestConfig, TestDiffSource, TestResult } from '../../model/test.ts';
import type { Counts, SuiteConfig, SuiteResult } from '../../model/suite.ts';
import { DelegatingConsumer } from './delegating.ts';
import type { SuiteCore } from '../../model/common.ts';
import { TestModelUtil } from '../../model/util.ts';

type ClassId = string;
type ImportName = string;

type CumulativeTestResult = Pick<TestResult, 'sourceHash' | 'status' | 'duration'>;
type CumulativeSuiteResult = Pick<SuiteCore, 'import' | 'classId' | 'sourceHash'> & {
  tests: Record<string, CumulativeTestResult>;
};

/**
 * Cumulative Summary consumer
 */
export class CumulativeSummaryConsumer extends DelegatingConsumer {
  /**
   * Total state of all tests run so far
   */
  #state: Record<ImportName, Record<ClassId, CumulativeSuiteResult>> = {};

  constructor(target: TestConsumerShape) {
    super([target]);
  }

  getSuite(core: Pick<SuiteCore, 'import' | 'classId'>): CumulativeSuiteResult {
    return this.#state[core.import]?.[core.classId];
  }

  getOrCreateSuite({ tests: _, ...core }: SuiteConfig | SuiteResult): CumulativeSuiteResult {
    return (this.#state[core.import] ??= {})[core.classId] ??= { ...core, tests: {} };
  }

  onTestBefore(config: TestConfig): TestConfig {
    const suite = this.getSuite(config);
    suite.tests[config.methodName] = { sourceHash: config.sourceHash, status: 'unknown', duration: 0 };
    return config;
  }

  onTestAfter(result: TestResult): TestResult {
    const test = this.getSuite(result).tests[result.methodName];
    Object.assign(test, { status: result.status, duration: result.duration });
    return result;
  }

  onSuiteBefore(config: SuiteConfig): SuiteConfig {
    const suite = this.getOrCreateSuite(config);
    suite.sourceHash = config.sourceHash;
    return config;
  }

  onSuiteAfter(result: SuiteResult): SuiteResult {
    // Reset counts
    const suite = this.getSuite(result);
    const totals: Counts & { duration: number } = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errored: 0,
      unknown: 0,
      total: 0,
      duration: 0
    };
    for (const test of Object.values(suite.tests)) {
      totals[test.status] += 1;
      totals.total += 1;
      totals.duration += test.duration ?? 0;
    }
    return { ...result, ...totals, status: TestModelUtil.countsToTestStatus(totals) };
  }

  removeTest(importName: string, classId?: string, methodName?: string): void {
    if (methodName && classId && importName) {
      delete this.getSuite({ import: importName, classId }).tests[methodName];
    } else if (classId && importName) {
      delete this.#state[importName][classId];
    } else if (importName) {
      delete this.#state[importName];
    }
  }

  transformRemove(event: TestRemoveEvent): TestRemoveEvent {
    this.removeTest(event.import, event.classId, event.methodName);
    return event;
  }

  /**
   * Handle cumulative events, and emit a summarized summary
   */
  transform(event: TestEvent): TestEvent | undefined {
    try {
      if (event.type === 'suite') {
        if (event.phase === 'before') {
          return { ...event, suite: this.onSuiteBefore(event.suite) };
        } else if (event.phase === 'after') {
          return { ...event, suite: this.onSuiteAfter(event.suite) };
        }
      } else if (event.type === 'test') {
        if (event.phase === 'before') {
          return { ...event, test: this.onTestBefore(event.test) };
        } else if (event.phase === 'after') {
          return { ...event, test: this.onTestAfter(event.test) };
        }
      }
      return event;
    } catch (error) {
      console.warn('Summarization Error', { error });
    }
  }

  /**
   * Produce diff source for import file
   */
  produceDiffSource(importName: string): TestDiffSource {
    const output: TestDiffSource = {};
    for (const [clsId, suite] of Object.entries(this.#state[importName] || {})) {
      const methods: TestDiffSource[string]['methods'] = {};
      for (const [methodName, test] of Object.entries(suite.tests)) {
        methods[methodName] = test.sourceHash!;
      }
      output[clsId] = { sourceHash: suite.sourceHash!, methods };
    }
    return output;
  }
}