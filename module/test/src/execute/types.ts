import { TestConsumer } from '../consumer/types';
import { TestRun } from '../worker/types';

/**
 * Run state
 */
export interface RunState {
  /**
   * Output format
   */
  format: string;
  /**
   * The run consumer
   */
  consumer?: TestConsumer;
  /**
   * Number of test suites to run concurrently, when mode is not single
   */
  concurrency?: number;
  /**
   * The tags to include or exclude from testing
   */
  tags?: string[];
  /**
   * target
   */
  target: TestRun | {
    /**
     * Globs to run
     */
    globs?: string[];
  };
}
