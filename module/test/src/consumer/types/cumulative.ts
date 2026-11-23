import type { SuiteCore } from '../../model/common.ts';
import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';
import type { SuiteConfig, SuiteResult } from '../../model/suite.ts';
import type { TestConfig, TestDiffSource, TestResult } from '../../model/test.ts';
import { TestModelUtil } from '../../model/util.ts';
import type { TestConsumerShape } from '../types.ts';
import { DelegatingConsumer } from './delegating.ts';

type ClassId = string;
type ImportName = string;

type CumulativeTestResult = Pick<TestResult, 'sourceHash' | 'status' | 'duration' | 'selfDuration'>;
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
  #failing = new Set<ImportName>();
  #lastFailed = new Map<ImportName, number>();
  #failureSequence = 0;

  constructor(target: TestConsumerShape) {
    super([target]);
  }

  getSuite(core: Pick<SuiteCore, 'import' | 'classId'>): CumulativeSuiteResult {
    return this.#state[core.import]?.[core.classId];
  }

  getOrCreateSuite({ tests: _, ...core }: SuiteConfig | SuiteResult): CumulativeSuiteResult {
    return ((this.#state[core.import] ??= {})[core.classId] ??= { ...core, tests: {} });
  }

  onTestBefore(config: TestConfig): TestConfig {
    const suite = this.getSuite(config);
    suite.tests[config.methodName] = { sourceHash: config.sourceHash, status: 'unknown', duration: 0, selfDuration: 0 };
    return config;
  }

  onTestAfter(result: TestResult): TestResult {
    const test = this.getSuite(result).tests[result.methodName];
    Object.assign(test, { status: result.status, duration: result.duration });
    if (result.status === 'failed' || result.status === 'errored') {
      this.#failing.add(result.import);
      this.#lastFailed.set(result.import, (this.#failureSequence += 1));
    }
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
    const results = TestModelUtil.buildSummary();
    TestModelUtil.countTestResult(results, Object.values(suite.tests));
    const hasFailures = Object.values(this.#state[result.import] ?? {}).some(entry =>
      Object.values(entry.tests).some(test => test.status === 'failed' || test.status === 'errored')
    );
    if (!hasFailures) {
      this.#failing.delete(result.import);
    }
    return { ...result, ...results, status: TestModelUtil.computeTestStatus(results) };
  }

  /**
   * Rank import by failure recency (currently failing first, then most recently failed)
   */
  getFailureRank(importName: string): number {
    const sequence = this.#lastFailed.get(importName) ?? 0;
    if (this.#failing.has(importName)) {
      return 1_000_000_000 + sequence;
    }
    return sequence;
  }

  removeTest(importName: string, classId?: string, methodName?: string): void {
    if (methodName && classId && importName) {
      delete this.getSuite({ import: importName, classId }).tests[methodName];
    } else if (classId && importName) {
      delete this.#state[importName][classId];
    } else if (importName) {
      delete this.#state[importName];
      this.#failing.delete(importName);
      this.#lastFailed.delete(importName);
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
