import { ErrorUtil } from '@travetto/base/src/internal/error';
import { ParentCommChannel, Worker, WorkUtil } from '@travetto/worker';
import { AppCache, ExecUtil } from '@travetto/boot';

import { Events, RunEvent } from './types';
import { TestConsumer } from '../consumer/types';
import { TestEvent } from '../model/event';

/**
 *  Produce a handler for the child worker
 */
export function buildStandardTestManager(consumer: TestConsumer): () => Worker<string> {
  /**
   * Spawn a child
   */
  return () => WorkUtil.spawnedWorker(
    () => ExecUtil.forkMain('@travetto/test/support/main.test-child', [], {
      env: { TRV_CACHE: AppCache.cacheDir }
    }),
    /**
     * Child initialization
     */
    async (channel: ParentCommChannel<TestEvent>): Promise<void> => {
      await channel.once(Events.READY); // Wait for the child to be ready
      await channel.send(Events.INIT); // Initialize
      await channel.once(Events.INIT_COMPLETE); // Wait for complete
      channel.on('*', async ev => {
        try {
          await consumer.onEvent(ev);  // Connect the consumer with the event stream from the child
        } catch {
          // Do nothing
        }
      });
    },
    /**
     * Send child command to run tests
     */
    async (channel: ParentCommChannel<TestEvent & { error?: Error }>, event: string | RunEvent): Promise<void> => {
      // Listen for child to complete
      const complete = channel.once(Events.RUN_COMPLETE);
      // Start test
      event = typeof event === 'string' ? { file: event } : event;
      channel.send(Events.RUN, event);

      // Wait for complete
      const { error } = await complete;

      // If we received an error, throw it
      if (error) {
        throw ErrorUtil.deserializeError(error);
      }
    });
}