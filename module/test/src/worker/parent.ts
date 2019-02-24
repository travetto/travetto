import { Env } from '@travetto/base';

import { ParentCommChannel, CommUtil, WorkUtil } from '@travetto/worker';
import { Events, TEST_BASE } from './types';
import { Consumer } from '../model/consumer';

export function buildWorkManager(consumer: Consumer) {
  return WorkUtil.spawnedWorker<string>({
    command: `${TEST_BASE}/bin/travetto-test-worker`,
    fork: true,
    opts: {
      cwd: Env.cwd,
      env: {
        ...process.env,
        ...(process.env.NODE_PRESERVE_SYMLINKS === '1' ? { // Only pass base path if preserving symlinks
          TRV_TEST_BASE: TEST_BASE
        } : {}),
      }
    },
    async init(channel: ParentCommChannel) {
      await channel.listenOnce(Events.READY);
      await channel.send(Events.INIT);
      await channel.listenOnce(Events.INIT_COMPLETE);
      channel.listen(consumer.onEvent as any); // Connect the consumer with the event stream from the child
    },
    async execute(channel: ParentCommChannel, file: string) {
      const complete = channel.listenOnce(Events.RUN_COMPLETE);
      channel.send(Events.RUN, { file });

      const { error } = await complete;

      if (error) {
        const fullError = CommUtil.deserializeError(error);
        throw fullError;
      }
    }
  });
}