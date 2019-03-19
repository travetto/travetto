import * as path from 'path';

import { Env } from '@travetto/base';

import { ParentCommChannel, CommUtil, WorkUtil } from '@travetto/worker';
import { Events } from './types';
import { Consumer } from '../model/consumer';

const TRV_TEST_ROOT = path.resolve(__dirname, '../..');

export function buildWorkManager(consumer: Consumer) {
  return WorkUtil.spawnedWorker<string>({
    command: `${TRV_TEST_ROOT}/bin/test-worker`,
    fork: true,
    opts: { cwd: Env.cwd, env: { ...process.env, TRV_TEST_ROOT } },
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