import { RootIndex } from '@travetto/manifest';
import { ExecUtil, ErrorUtil } from '@travetto/base';
import { ParentCommChannel, Worker } from '@travetto/worker';

import { Events, RunEvent } from './types';
import { TestConsumer } from '../consumer/types';
import { TestEvent } from '../model/event';

let i = 0;

function buildEvent(ev: string): RunEvent {
  if (ev.includes('#')) {
    const [file, cls, method] = ev.split('#');
    return { file, class: cls, method };
  } else {
    return { file: ev };
  }
}

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
      const event = buildEvent(file);

      const { module } = RootIndex.getEntry(event.file!)!;
      const cwd = RootIndex.getModule(module)!.sourcePath;

      const channel = new ParentCommChannel<TestEvent & { error?: Error }>(
        ExecUtil.fork(
          RootIndex.resolveFileImport('@travetto/cli/support/cli.ts'),
          ['main', '@travetto/test/src/worker/child.ts'],
          {
            cwd,
            env: { TRV_MANIFEST: RootIndex.getModule(module)!.output },
            stdio: [0, 'ignore', 2, 'ipc']
          }
        )
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
      channel.send(Events.RUN, event);

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