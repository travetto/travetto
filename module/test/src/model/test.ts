import { Class } from '@travetto/registry/src/types';
import { TestCore } from './common';

export type ThrowableError = string | RegExp | Function;

/**
 * Specific configuration for a test
 */
export interface TestConfig extends TestCore {
  /**
   * The Class it's a part of
   */
  class: Class<any>;
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
  skip: boolean;
  /**
   * Override the timeout duration
   */
  timeout?: number;
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
  actual?: any;
  /**
   * Expected value
   */
  expected?: any;
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