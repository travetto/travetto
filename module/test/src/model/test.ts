import type { Class, TimeSpan } from '@travetto/base';
import { Skip, TestCore } from './common';

export type ThrowableError = string | RegExp | Function;

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
   * File of assertion
   */
  file: string;
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
  status: 'passed' | 'skipped' | 'failed';
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
  output: Record<string, string>;
}