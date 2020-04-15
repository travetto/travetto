import { Env } from '@travetto/base';

import { ParentCommChannel, CommUtil, WorkUtil } from '@travetto/worker';
import { Events, RunEvent } from './types';
import { Consumer } from '../model/consumer';

export function buildWorkManager(consumer: Consumer) {
  return WorkUtil.spawnedWorker<string>({
    command: `${__dirname}/../../bin/test-worker`,
    fork: true,
    opts: { cwd: Env.cwd },
    async init(channel: ParentCommChannel) {
      await channel.listenOnce(Events.READY);
      await channel.send(Events.INIT);
      await channel.listenOnce(Events.INIT_COMPLETE);
      channel.listen(consumer.onEvent as any); // Connect the consumer with the event stream from the child
    },
    async execute(channel: ParentCommChannel, event: string | RunEvent) {
      const complete = channel.listenOnce(Events.RUN_COMPLETE);
      channel.send(Events.RUN, typeof event === 'string' ? { file: event } : event);

      const { error } = await complete;

      if (error) {
        const fullError = CommUtil.deserializeError(error);
        throw fullError;
      }
    }
  });
}