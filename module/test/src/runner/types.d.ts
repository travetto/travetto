import { Consumer } from '../model/consumer';

/**
 * Run state
 */
export interface RunState {
  /**
   * Output format
   */
  format: 'json' | 'exec' | 'tap' | 'events' | 'noop';
  /**
   * The run consumer
   */
  consumer?: Consumer;
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
