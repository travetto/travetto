import path from 'node:path';

import { asFull, RuntimeIndex } from '@travetto/runtime';

import type { ResultsSummary, SuiteConfig, SuiteResult } from './suite.ts';
import type { TestConfig, TestResult, TestRun, TestStatus } from './test.ts';

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

  static countTestResult<T extends ResultsSummary>(summary: T, tests: Pick<TestResult, 'status' | 'selfDuration' | 'duration'>[]): T {
    for (const test of tests) {
      summary[test.status] += 1;
      summary.total += 1;
      summary.selfDuration += (test.selfDuration ?? 0);
      summary.duration += (test.duration ?? 0);
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

  static createImportErrorSuiteResult(run: TestRun): SuiteResult {
    const name = path.basename(run.import);
    const classId = `${RuntimeIndex.getFromImport(run.import)?.id}#${name}`;
    const common = { classId, duration: 0, lineStart: 1, lineEnd: 1, import: run.import } as const;
    return asFull<SuiteResult>({
      ...common,
      status: 'errored', errored: 1,
      tests: {
        impport: asFull<TestResult>({
          ...common,
          status: 'errored',
          assertions: [{
            ...common, line: common.lineStart,
            methodName: 'import', operator: 'import', text: `Failed to import ${run.import}`,
          }]
        })
      }
    });
  }
}