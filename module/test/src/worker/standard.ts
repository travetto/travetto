import { fork } from 'node:child_process';

import { Env, RuntimeIndex } from '@travetto/runtime';
import { IpcChannel } from '@travetto/worker';

import { TestWorkerEvents, type TestLogEvent } from './types.ts';
import type { TestConsumerShape } from '../consumer/types.ts';
import type { TestEvent, TestRemoveEvent } from '../model/event.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';
import { CommunicationUtil } from '../communication.ts';

const log = (message: string | TestLogEvent): void => {
  const event: TestLogEvent = typeof message === 'string' ? { type: 'log', message } : message;
  process.send ? process.send?.(event) : console.debug(event.message);
};

/**
 *  Produce a handler for the child worker
 */
export async function buildStandardTestManager(consumer: TestConsumerShape, run: TestRun | TestDiffInput): Promise<void> {
  log(`Worker Input ${JSON.stringify(run)}`);

  const suiteMod = RuntimeIndex.findModuleForArbitraryImport(run.import)!;

  const channel = new IpcChannel<TestEvent & { error?: Error }>(
    fork(
      RuntimeIndex.resolveFileImport('@travetto/cli/support/entry.trv.ts'), ['test:child'],
      {
        cwd: suiteMod.sourcePath,
        env: {
          ...process.env,
          ...Env.TRV_MANIFEST.export(suiteMod.outputPath),
          ...Env.TRV_QUIET.export(true)
        },
        stdio: ['ignore', 'ignore', 2, 'ipc']
      }
    )
  );

  await channel.once(TestWorkerEvents.READY); // Wait for the child to be ready
  await channel.send(TestWorkerEvents.INIT); // Initialize
  await channel.once(TestWorkerEvents.INIT_COMPLETE); // Wait for complete

  channel.on('*', async event => {
    try {
      const parsed: TestEvent | TestRemoveEvent | TestLogEvent = CommunicationUtil.deserializeFromObject(event);
      if (parsed.type === 'log') {
        log(parsed);
      } else if (parsed.type === 'removeTest') {
        log(`Received remove event ${JSON.stringify(event)}@${consumer.constructor.name}`);
        await consumer.onRemoveEvent?.(parsed); // Forward remove events
      } else {
        await consumer.onEvent(parsed);  // Forward standard events
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
  const result: { error?: unknown } = await CommunicationUtil.deserializeFromObject(completedEvent);

  // Kill on complete
  await channel.destroy();

  log(`Worker Finished ${run.import}`);

  // If we received an error, throw it
  if (result.error) {
    throw result.error;
  }
}