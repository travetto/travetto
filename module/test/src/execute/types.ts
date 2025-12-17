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
  consumerOptions?: Record<string, unknown>;
  /**
   * Number of test suites to run concurrently, when mode is not single
   */
  concurrency?: number;
}
