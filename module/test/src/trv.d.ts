import { TimeSpan } from '@travetto/base';

declare global {
  interface TravettoEnv {
    /**
     * The default time to wait for each phase to finish.
     * @default 15s
     */
    TRV_TEST_PHASE_TIMEOUT: TimeSpan | number;
    /**
     * The default time for a single test to finish.
     * @default 5s
     */
    TRV_TEST_TIMEOUT: TimeSpan | number;
    /**
     * An additional wait for triggering test runs, useful for code that takes time to warm up
     */
    TRV_TEST_DELAY: TimeSpan | number;
    /**
     * Should the test break on the first line of debugging
     */
    TRV_TEST_BREAK_ENTRY: boolean;
  }
}