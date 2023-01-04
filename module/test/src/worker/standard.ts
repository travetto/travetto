import { RootIndex } from '@travetto/manifest';
import { ExecUtil, ErrorUtil } from '@travetto/base';
import { ParentCommChannel, Worker } from '@travetto/worker';

import { Events } from './types';
import { TestConsumer } from '../consumer/types';
import { TestEvent } from '../model/event';

let i = 0;

/**
 *  Produce a handler for the child worker
 */
export function buildStandardTestManager(consumer: TestConsumer): () => Worker<string> {
  /**
   * Spawn a child
   */
  return () => ({
    id: i += 1,
    active: true,
    async destroy(): Promise<void> { },
    async execute(file: string): Promise<void> {
      const { module } = RootIndex.getFromSource(file)!;
      const cwd = RootIndex.getModule(module)!.source;

      const channel = new ParentCommChannel<TestEvent & { error?: Error }>(
        ExecUtil.fork(RootIndex.resolveFileImport('@travetto/test/support/main.test-child.ts'), [], {
          cwd,
          env: { TRV_MANIFEST: module },
          stdio: [0, 'ignore', 2, 'ipc']
        })
      );

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

      // Listen for child to complete
      const complete = channel.once(Events.RUN_COMPLETE);
      // Start test
      channel.send(Events.RUN, { file });

      // Wait for complete
      const { error } = await complete;

      // Kill on complete
      await channel.destroy();

      // If we received an error, throw it
      if (error) {
        throw ErrorUtil.deserializeError(error);
      }
    },
  });
}