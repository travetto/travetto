import { Class } from '@travetto/registry/src/types';

import { TestConfig, TestResult } from './test';
import { SuiteCore } from './common';

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
  skip: boolean;
  /**
   * Actual class instance
   */
  instance: any;
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
   * File suite is in
   */
  file: string;
  /**
   * Lines of the suite
   */
  lines: { start: number, end: number };
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
 * All suite results
 */
export interface AllSuitesResult extends Counts {
  /**
   * List of all suites
   */
  suites: SuiteResult[];
  /**
   * List of all errors
   */
  errors: Error[];
  /**
   * Total duration
   */
  duration: number;
}