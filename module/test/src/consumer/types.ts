import { TestEvent } from '../model/event';
import { Counts, SuiteResult } from '../model/suite';

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

/**
 * A test result handler
 */
export interface TestConsumer {
  /**
   * Listen for start of the test run
   */
  onStart?(): void;
  /**
   * Handle individual tests events
   */
  onEvent(event: TestEvent): void;
  /**
   * Summarize all results
   */
  onSummary?(summary: SuitesSummary): void;
}
