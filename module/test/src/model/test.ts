import type { Class, ConsoleEvent, TimeSpan } from '@travetto/runtime';

import type { Skip, TestCore } from './common.ts';

export type ThrowableError = string | RegExp | Class<Error> | ((error: Error | string) => boolean | void | undefined);
export type TestLog = Omit<ConsoleEvent, 'args' | 'scope'> & { message: string };

export type TestDiffSource = Record<string, {
  sourceHash: number;
  methods: Record<string, number>;
}>;

export type TestStatus = 'passed' | 'skipped' | 'errored' | 'failed' | 'unknown';

/**
 * Specific configuration for a test
 */
export interface TestConfig extends TestCore {
  /**
   * The Class it's a part of
   */
  class: Class;
  /**
   * The test's method name
   */
  methodName: string;
  /**
   * Should the test throw
   */
  shouldThrow?: ThrowableError;
  /**
   * Should it be skipped
   */
  skip: Skip;
  /**
   * Override the timeout duration
   */
  timeout?: number | TimeSpan;
}

/**
 * A specific assertion output
 */
export interface Assertion {
  /**
   * Class the assertion is in
   */
  classId: string;
  /**
   * The method of the assertion is in
   */
  methodName: string;
  /**
   * Provided value
   */
  actual?: unknown;
  /**
   * Expected value
   */
  expected?: unknown;
  /**
   * Operator
   */
  operator: string;
  /**
   * Error message
   */
  message?: string;
  /**
   * Actual error
   */
  error?: Error;
  /**
   * Import of assertion
   */
  import: string;
  /**
   * Line number
   */
  line: number;
  /**
   * Full text of expression
   */
  text: string;
}

/**
 * Test results
 */
export interface TestResult extends TestCore {
  /**
   * The test's method name
   */
  methodName: string;
  /**
   * status
   */
  status: TestStatus;
  /**
   * Error if failed
   */
  error?: Error;
  /**
   * List of assertions
   */
  assertions: Assertion[];
  /**
   * Duration for the test
   */
  duration: number;
  /**
   * Total duration including before/after
   */
  durationTotal: number;
  /**
   * Logging output
   */
  output: TestLog[];
  /**
   * Know where the suite started for this test
   */
  suiteLineStart: number;
}

/**
 * Test Run
 */
export type TestRun = {
  /**
   * Import for run
   */
  import: string;
  /**
   * Suite class id
   */
  classId?: string;
  /**
   * Methods names we want to target
   */
  methodNames?: string[];
  /**
   * Test run metadata
   */
  metadata?: Record<string, unknown>;
  /**
   * unique id for the run
   */
  runId?: string;
};

/**
 * Test Diff Input
 */
export type TestDiffInput = {
  /**
   * Import for run
   */
  import: string;
  /**
   * Diff Source
   */
  diffSource: TestDiffSource;
  /**
   * Test run metadata
   */
  metadata?: Record<string, unknown>;
};

/**
 * Test Glob Input
 */
export type TestGlobInput = {
  /**
   * Globs to run
   */
  globs: string[];
  /**
   * Tags to filter by
   */
  tags?: string[];
  /**
   * Test run metadata
   */
  metadata?: Record<string, unknown>;
};

export type TestRunInput = TestRun | TestDiffInput | TestGlobInput;