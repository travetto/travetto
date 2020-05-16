import { TestEvent } from '../model/event';
import { AllSuitesResult } from '../model/suite';

/**
 * A test result consumer
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
  onSummary?(summary: AllSuitesResult): void;
}