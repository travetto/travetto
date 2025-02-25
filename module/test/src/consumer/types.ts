import { TestEvent } from '../model/event.ts';
import { Counts, SuiteResult } from '../model/suite.ts';

/**
 * All suite results
 */
export interface SuitesSummary extends Counts {
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

export type TestRunState = {
  testCount?: number;
};

/**
 * A test consumer shape
 */
export interface TestConsumerShape {
  /**
   * Set options
   */
  setOptions?(options?: Record<string, unknown>): Promise<void> | void;
  /**
   * Listen for start of the test run
   */
  onStart?(testState: TestRunState): Promise<void> | void;
  /**
   * Handle individual tests events
   */
  onEvent(event: TestEvent): void;
  /**
   * Summarize all results
   */
  onSummary?(summary: SuitesSummary): Promise<void> | void;
}
