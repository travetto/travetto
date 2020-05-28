import { ErrorUtil } from '@travetto/base/src/internal/error';
import { ParentCommChannel, WorkUtil } from '@travetto/worker';
import { Events, RunEvent } from './types';
import { TestConsumer } from '../consumer/types';

/**
 *  Produce a handler for the child worker
 */
export function buildWorkManager(consumer: TestConsumer) {
  /**
   * Spawn a child
   */
  return WorkUtil.spawnedWorker(`${__dirname}/../../bin/test-worker`, {
    handlers: {
      /**
       * Child initialization
       */
      async init(channel: ParentCommChannel) {
        await channel.listenOnce(Events.READY); // Wait for the child to be ready
        await channel.send(Events.INIT); // Initialize
        await channel.listenOnce(Events.INIT_COMPLETE); // Wait for complete
        channel.listen(consumer.onEvent.bind(consumer)); // Connect the consumer with the event stream from the child
      },
      /**
       * Send child command to run tests
       */
      async execute(channel: ParentCommChannel, event: string | RunEvent) {
        // Listen for child to complete
        const complete = channel.listenOnce(Events.RUN_COMPLETE);
        // Start test
        channel.send(Events.RUN, typeof event === 'string' ? { file: event } : event);

        // Wait for complete
        const { error } = await complete;

        // If we received an error, throw it
        if (error) {
          throw ErrorUtil.deserializeError(error);
        }
      }
    }
  });
}