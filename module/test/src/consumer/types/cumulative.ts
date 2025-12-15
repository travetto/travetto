import type { TestConsumerShape } from '../types.ts';
import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';
import type { TestDiffSource, TestResult } from '../../model/test.ts';
import type { SuiteConfig, SuiteResult } from '../../model/suite.ts';
import { DelegatingConsumer } from './delegating.ts';
import { SuiteCore } from '../../model/common.ts';

type ClassId = string;
type ImportName = string;

/**
 * Cumulative Summary consumer
 */
export class CumulativeSummaryConsumer extends DelegatingConsumer {
  /**
   * Total state of all tests run so far
   */
  #state: Record<ImportName, Record<ClassId, SuiteResult>> = {};

  constructor(target: TestConsumerShape) {
    super([target]);
  }

  getSuite(core: Pick<SuiteCore, 'import' | 'classId'>): SuiteResult {
    return this.#state[core.import][core.classId];
  }

  onSuiteStart(config: SuiteConfig): void {
    this.#state[config.import] ??= {};
    this.#state[config.import][config.classId] = {
      ...config,
      duration: -1,
      failed: 0,
      passed: 0,
      skipped: 0,
      total: 0,
      tests: {}
    };
  }

  onSuiteAfter({ tests: _, ...suite }: SuiteResult): void {
    Object.assign(this.getSuite(suite), suite);
  }

  onTestResult(test: TestResult): void {
    const tests = this.getSuite(test).tests;
    tests[test.methodName] = { ...tests[test.methodName], ...test };
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

  /**
   * Compute totals
   */
  computeTotal(importName: string, classId: ClassId): SuiteResult {
    const suite = this.#state[importName][classId];
    return {
      classId: suite.classId,
      passed: suite.passed,
      failed: suite.failed,
      skipped: suite.skipped,
      import: suite.import,
      lineStart: suite.lineStart,
      lineEnd: suite.lineEnd,
      total: suite.total,
      tests: {},
      duration: 0
    };
  }

  triggerSummary(core: SuiteCore): void {
    this.onEvent({
      type: 'suite',
      phase: 'after',
      suite: this.getSuite(core)
    });
  }

  onRemoveEvent(event: TestRemoveEvent): void {
    this.removeTest(event.import, event.classId, event.methodName);
  }

  /**
   * Listen for event, process the full event, and if the event is an after test,
   * send a full suite summary
   */
  onEventDone(event: TestEvent): void {
    try {
      if (event.type === 'suite') {
        if (event.phase === 'before') {
          this.onSuiteStart(event.suite);
        } else if (event.phase === 'after') {
          this.onSuiteAfter(event.suite);
          this.triggerSummary(event.suite);
        }
      } else if (event.type === 'test') {
        if (event.phase === 'after') {
          this.onTestResult(event.test);
          this.triggerSummary(event.test);
        }
      }
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
      output[clsId] = {
        sourceHash: suite.sourceHash!,
        methods
      };
      for (const [methodName, test] of Object.entries(suite.tests)) {
        methods[methodName] = test.sourceHash!;
      }
    }
    return output;
  }
}