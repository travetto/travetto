import { ErrorUtil } from '@travetto/base/src/internal/error';
import { ParentCommChannel, WorkUtil } from '@travetto/worker';
import { AppCache, ExecUtil } from '@travetto/boot';

import { Events, RunEvent } from './types';
import { TestConsumer } from '../consumer/types';
import { TestEvent } from '../model/event';
import { TestResult } from '../model/test';

/**
 *  Produce a handler for the child worker
 */
export function buildStandardTestManager(consumer: TestConsumer) {
  /**
   * Spawn a child
   */
  return () => WorkUtil.spawnedWorker(
    () => ExecUtil.forkMain('@travetto/test/bin/test-child', [], {
      env: {
        TRV_WATCH: '0',
        TRV_CACHE: AppCache.cacheDir
      }
    }),
    /**
     * Child initialization
     */
    async (channel: ParentCommChannel<TestEvent>) => {
      await channel.listenOnce(Events.READY); // Wait for the child to be ready
      await channel.send(Events.INIT); // Initialize
      await channel.listenOnce(Events.INIT_COMPLETE); // Wait for complete
      channel.listen(consumer.onEvent.bind(consumer)); // Connect the consumer with the event stream from the child
    },
    /**
     * Send child command to run tests
     */
    async (channel: ParentCommChannel<TestEvent>, event: string | RunEvent) => {
      // Listen for child to complete
      const complete = channel.listenOnce(Events.RUN_COMPLETE);
      // Start test
      event = typeof event === 'string' ? { file: event } : event;
      channel.send(Events.RUN, event);

      // Wait for complete
      const { error } = await (complete as unknown as TestResult);

      // If we received an error, throw it
      if (error) {
        throw ErrorUtil.deserializeError(error);
      }
    });
}