import type { Class } from '@travetto/runtime';

import { Assertion, TestConfig, TestResult } from './test';
import { Skip, SuiteCore } from './common';

/**
 * Suite configuration
 */
export interface SuiteConfig<T = unknown> extends SuiteCore {
  /**
   * Class suite is in
   */
  class: Class<T>;
  /**
   * Should this be skipped
   */
  skip: Skip;
  /**
   * Actual class instance
   */
  instance: T;
  /**
   * List of tests to run
   */
  tests: TestConfig[];
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
export interface SuiteResult extends Counts {
  /**
   * Class identifier
   */
  classId: string;
  /**
   * Import for the suite
   */
  import: string;
  /**
   * Start of the suite
   */
  lineStart: number;
  /**
   * End of the suite
   */
  lineEnd: number;
  /**
   * ALl test results
   */
  tests: TestResult[];
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
