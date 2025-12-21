import type { TestConsumerShape } from '../types.ts';
import type { TestEvent, TestRemoveEvent } from '../../model/event.ts';
import type { TestConfig, TestDiffSource, TestResult } from '../../model/test.ts';
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
    return this.#state[core.import]?.[core.classId];
  }

  getOrCreateSuite({ tests: _, ...core }: SuiteConfig | SuiteResult): SuiteResult {
    return (this.#state[core.import] ??= {})[core.classId] ??= {
      failed: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
      total: 0,
      duration: -1,
      ...core,
      tests: {},
    };
  }

  onTestBefore(config: TestConfig): TestConfig {
    const suite = this.getSuite(config);
    suite.tests[config.methodName] = {
      ...suite.tests[config.methodName],
      ...config,
      error: undefined,
      sourceImport: config.sourceImport,
      tags: config.tags,
      duration: -1,
      assertions: [],
      output: [],
      durationTotal: -1,
      status: 'unknown'
    };
    return config;
  }

  // Receive updated suite data
  onSuiteBefore(config: SuiteConfig): SuiteConfig {
    const suite = this.getOrCreateSuite(config);
    suite.lineEnd = config.lineEnd;
    suite.lineStart = config.lineStart;
    suite.sourceHash = config.sourceHash;
    suite.tags = config.tags;
    return config;
  }

  onSuiteAfter(suite: SuiteResult): SuiteResult {
    const state = this.getSuite(suite);

    const computeTotals = Object.entries(state.tests).reduce((acc, [, test]) => {
      switch (test.status) {
        case 'passed':
        case 'failed':
        case 'unknown':
        case 'skipped': acc[test.status] += 1; break;
      }
      acc.total += 1;
      acc.duration += test.duration ?? 0;
      return acc;
    }, { passed: 0, failed: 0, skipped: 0, total: 0, duration: 0, unknown: 0 });

    Object.assign(state, computeTotals, {
      sourceHash: suite.sourceHash,
    });

    return state;
  }

  onTestAfter(test: TestResult): TestResult {
    const tests = this.getSuite(test).tests;
    return Object.assign(tests[test.methodName], test);
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

  onRemoveEvent(event: TestRemoveEvent): void {
    this.removeTest(event.import, event.classId, event.methodName);
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