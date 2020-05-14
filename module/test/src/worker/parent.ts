import { ErrorUtil } from '@travetto/base/src/internal/error';
import { ParentCommChannel, WorkUtil } from '@travetto/worker';
import { Events, RunEvent } from './types';
import { Consumer } from '../model/consumer';

// TODO: Document
export function buildWorkManager(consumer: Consumer) {
  return WorkUtil.spawnedWorker(`${__dirname}/../../bin/test-worker`, {
    handlers: {
      async init(channel: ParentCommChannel) {
        await channel.listenOnce(Events.READY);
        await channel.send(Events.INIT);
        await channel.listenOnce(Events.INIT_COMPLETE);
        channel.listen(consumer.onEvent.bind(consumer)); // Connect the consumer with the event stream from the child
      },
      async execute(channel: ParentCommChannel, event: string | RunEvent) {
        const complete = channel.listenOnce(Events.RUN_COMPLETE);
        channel.send(Events.RUN, typeof event === 'string' ? { file: event } : event);

        const { error } = await complete;

        if (error) {
          throw ErrorUtil.deserializeError(error);
        }
      }
    }
  });
}