import { TimeSpan } from '@travetto/runtime';

declare module '@travetto/runtime' {
  interface EnvData {
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
     * The tags to include or exclude during testing
     */
    TRV_TEST_TAGS: string[];
  }
}