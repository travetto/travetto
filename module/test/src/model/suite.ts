import type { Any, Class } from '@travetto/runtime';

import type { Assertion, TestConfig, TestResult, TestStatus } from './test.ts';
import type { Skip, SuiteCore } from './common.ts';

export type SuitePhase = 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach';

export type SuitePhaseHandler<T extends object> = Partial<Record<SuitePhase, (instance: T) => Promise<unknown> | unknown>>;

/**
 * Suite configuration
 */
export interface SuiteConfig extends SuiteCore {
  /**
   * Class suite is in
   */
  class: Class;
  /**
   * Should this be skipped
   */
  skip: Skip;
  /**
   * Actual class instance
   */
  instance?: unknown;
  /**
   * Tests to run
   */
  tests: Record<string, TestConfig>;
  /**
   * Phase handlers
   */
  phaseHandlers: SuitePhaseHandler<Any>[];
}

/**
 * All counts for the suite summary
 */
export interface Counts {
  passed: number;
  skipped: number;
  failed: number;
  errored: number;
  unknown: number;
  total: number;
}

/**
 * Results of a suite run
 */
export interface SuiteResult extends Counts, SuiteCore {
  /**
   * All test results
   */
  tests: Record<string, TestResult>;
  /**
   * Suite duration
   */
  duration: number;
  /**
   * Overall status
   */
  status: TestStatus;
}

/**
 * A total suite failure
 */
export interface SuiteFailure {
  assert: Assertion;
  testResult: TestResult;
  test: TestConfig;
  suite: SuiteConfig;
}
