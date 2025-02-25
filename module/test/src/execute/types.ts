import { TestRun } from '../model/test';

/**
 * Run state
 */
export interface RunState {
  /**
   * Test result consumer
   */
  consumer: string;
  /**
   * Test result consumer options?
   */
  consumerOptions?: Record<string, unknown>;
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
