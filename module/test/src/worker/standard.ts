import { fork } from 'node:child_process';

import { JSONUtil, Env, RuntimeIndex } from '@travetto/runtime';
import { IpcChannel } from '@travetto/worker';

import { TestWorkerEvents, type TestLogEvent } from './types.ts';
import type { TestConsumerShape } from '../consumer/types.ts';
import type { TestEvent, TestRemoveEvent } from '../model/event.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';

const log = (message: string | TestLogEvent): void => {
  const event: TestLogEvent = typeof message === 'string' ? { type: 'log', message } : message;
  process.send ? process.send?.(event) : console.debug(event.message);
};

/**
 *  Produce a handler for the child worker
 */
export async function buildStandardTestManager(consumer: TestConsumerShape, run: TestRun | TestDiffInput): Promise<void> {
  log(`Worker Input ${JSONUtil.toUTF8(run)}`);

  const channel = new IpcChannel<TestEvent & { error?: Error }>(
    fork(
      RuntimeIndex.resolveFileImport('@travetto/cli/support/entry.trv.ts'), ['test:child'],
      {
        env: {
          ...process.env,
          ...Env.TRV_QUIET.export(true)
        },
        stdio: ['ignore', 'ignore', 2, 'ipc']
      }
    )
  );

  await channel.once(TestWorkerEvents.READY); // Wait for the child to be ready
  channel.send(TestWorkerEvents.INIT); // Initialize
  await channel.once(TestWorkerEvents.INIT_COMPLETE); // Wait for complete

  channel.on('*', async event => {
    try {
      const parsed: TestEvent | TestRemoveEvent | TestLogEvent = JSONUtil.cloneFromTransmit(event);
      if (parsed.type === 'log') {
        log(parsed);
      } else if (parsed.type === 'removeTest') {
        log(`Received remove event ${JSONUtil.toUTF8(event)}@${consumer.constructor.name}`);
        consumer.onRemoveEvent?.(parsed); // Forward remove events
      } else {
        consumer.onEvent(parsed);  // Forward standard events
      }
    } catch {
      // Do nothing
    }
  });

  // Listen for child to complete
  const complete = channel.once(TestWorkerEvents.RUN_COMPLETE);
  // Start test
  channel.send(TestWorkerEvents.RUN, run);

  // Wait for complete
  const completedEvent = await complete;
  const result: { error?: unknown } = JSONUtil.cloneFromTransmit(completedEvent);

  // Kill on complete
  await channel.destroy();

  log(`Worker Finished ${run.import}`);

  // If we received an error, throw it
  if (result.error) {
    throw result.error;
  }
}