import type { ResultsSummary, SuiteConfig, SuiteResult } from './suite.ts';
import type { TestConfig, TestResult, TestStatus } from './test.ts';

export class TestModelUtil {
  static computeTestStatus(summary: ResultsSummary): TestStatus {
    switch (true) {
      case summary.errored > 0: return 'errored';
      case summary.failed > 0: return 'failed';
      case summary.skipped > 0: return 'skipped';
      case summary.unknown > 0: return 'unknown';
      default: return 'passed';
    }
  }

  static buildSummary(): ResultsSummary {
    return { passed: 0, failed: 0, skipped: 0, errored: 0, unknown: 0, total: 0, duration: 0, selfDuration: 0 };
  }

  static countTestResult<T extends ResultsSummary>(summary: T, tests: Pick<TestResult, 'status' | 'selfDuration'>[]): T {
    for (const test of tests) {
      summary[test.status] += 1;
      summary.total += 1;
      summary.selfDuration += (test.selfDuration ?? 0);
    }
    return summary;
  }


  /**
   * An empty suite result based on a suite config
   */
  static createSuiteResult(suite: SuiteConfig, override?: Partial<SuiteResult>): SuiteResult {
    return {
      ...TestModelUtil.buildSummary(),
      status: 'unknown',
      lineStart: suite.lineStart,
      lineEnd: suite.lineEnd,
      import: suite.import,
      classId: suite.classId,
      sourceHash: suite.sourceHash,
      tests: {},
      duration: 0,
      selfDuration: 0,
      ...override
    };
  }

  /**
   * An empty test result based on a suite and test config
   */
  static createTestResult(suite: SuiteConfig, test: TestConfig, override?: Partial<TestResult>): TestResult {
    return {
      methodName: test.methodName,
      description: test.description,
      classId: test.classId,
      tags: test.tags,
      suiteLineStart: suite.lineStart,
      lineStart: test.lineStart,
      lineEnd: test.lineEnd,
      lineBodyStart: test.lineBodyStart,
      import: test.import,
      declarationImport: test.declarationImport,
      sourceHash: test.sourceHash,
      status: 'unknown',
      assertions: [],
      duration: 0,
      selfDuration: 0,
      output: [],
      ...override
    };
  }
}