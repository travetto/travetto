import type { UnknownRecord } from '@travetto/runtime';

/**
 * Test Consumer Configuration
 */
export interface TestConsumerConfig {
  /**
   * Test result consumer
   */
  consumer: string;
  /**
   * Test result consumer options?
   */
  consumerOptions?: UnknownRecord;
  /**
   * Number of test suites to run concurrently, when mode is not single
   */
  concurrency?: number;
}
