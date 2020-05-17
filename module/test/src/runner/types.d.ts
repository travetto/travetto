import { TestConsumer } from '../model/consumer';

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
  mode: 'single' | 'watch' | 'all';
  /**
   * Number of test suites to run concurrently, when mode is not single
   */
  concurrency: number;
  /**
   * Input arguments
   */
  args: string[];
}
