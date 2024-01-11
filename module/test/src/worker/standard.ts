import { RuntimeIndex } from '@travetto/manifest';
import { Env, ExecUtil } from '@travetto/base';
import { ParentCommChannel, Worker } from '@travetto/worker';

import { Events, RunEvent } from './types';
import { TestConsumer } from '../consumer/types';
import { ErrorUtil } from '../consumer/error';
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
export function buildStandardTestManager(consumer: TestConsumer): Worker<string> {
  /**
   * Spawn a child
   */
  return {
    id: i += 1,
    active: true,
    async destroy(): Promise<void> { },
    async execute(file: string): Promise<void> {

      process.send?.({ type: 'log', message: `Worker Executing ${file}` });

      const event = buildEvent(file);

      const { module } = RuntimeIndex.getEntry(event.file!)!;
      const cwd = RuntimeIndex.getModule(module)!.sourcePath;

      const channel = new ParentCommChannel<TestEvent & { error?: Error }>(
        ExecUtil.spawn(
          process.argv0,
          [RuntimeIndex.resolveFileImport('@travetto/cli/support/entry.trv'), 'test:child'],
          {
            cwd,
            env: {
              ...process.env,
              ...Env.TRV_MANIFEST.export(RuntimeIndex.getModule(module)!.outputPath),
              ...Env.TRV_QUIET.export(true)
            },
            shell: false,
            stdio: ['ignore', 'ignore', 2, 'ipc']
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

      process.send?.({ type: 'log', message: `Worker Finished ${file}` });

      // If we received an error, throw it
      if (error) {
        throw ErrorUtil.deserializeError(error);
      }
    },
  };
}