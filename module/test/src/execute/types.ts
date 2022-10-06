import { TestConsumer } from '../consumer/types';

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
   * Test mode
   */
  mode?: 'single' | 'watch' | 'standard';
  /**
   * Number of test suites to run concurrently, when mode is not single
   */
  concurrency: number;
  /**
   * Run in isolated mode?
   */
  isolated?: boolean;
  /**
   * Input arguments
   */
  args: string[];
}
