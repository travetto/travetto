import type { Any, Class } from '@travetto/runtime';

import type { TestConfig, TestResult, TestStatus } from './test.ts';
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
 * Test Counts
 */
export interface ResultsSummary {
  /** Passing Test Count  */
  passed: number;
  /** Skipped Test Count  */
  skipped: number;
  /** Failed Test Count  */
  failed: number;
  /** Errored Test Count  */
  errored: number;
  /** Unknown Test Count  */
  unknown: number;
  /** Total Test Count  */
  total: number;
  /** Test Execution Duration  */
  duration: number;
}

/**
 * Results of a suite run
 */
export interface SuiteResult extends ResultsSummary, SuiteCore {
  /**
   * All test results
   */
  tests: Record<string, TestResult>;
  /**
   * Overall status
   */
  status: TestStatus;
}