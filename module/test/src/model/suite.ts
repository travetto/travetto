import type { Class } from '@travetto/runtime';

import { Assertion, TestConfig, TestResult } from './test.ts';
import { Skip, SuiteCore } from './common.ts';

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
   * Before all handlers
   */
  beforeAll: Function[];
  /**
   * Before each handlers
   */
  beforeEach: Function[];
  /**
   * After each handlers
   */
  afterEach: Function[];
  /**
   * After all handlers
   */
  afterAll: Function[];
}

/**
 * All counts for the suite summary
 */
export interface Counts {
  passed: number;
  skipped: number;
  failed: number;
  total: number;
}

/**
 * Results of a suite run
 */
export interface SuiteResult extends Counts, SuiteCore {
  /**
   * ALl test results
   */
  tests: Record<string, TestResult>;
  /**
   * Suite duration
   */
  duration: number;
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
