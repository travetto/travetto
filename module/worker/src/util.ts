import { SpawnConfig } from './comm/types';
import { ParentCommChannel } from './comm/parent';
import { CommUtil } from './comm/util';
import { Worker } from './pool';

export class WorkUtil {
  static spawnedWorker<X>(
    config: SpawnConfig & {
      init?: (channel: ParentCommChannel) => Promise<any>,
      execute: (channel: ParentCommChannel, input: X) => Promise<any>,
      destroy?: (channel: ParentCommChannel) => Promise<any>,
    }
  ): Worker<X> {
    const channel = new ParentCommChannel(
      CommUtil.spawnProcess(config)
    );
    return {
      get id() { return channel.id; },
      get active() { return channel.active; },
      init: config.init ? config.init.bind(config, channel) : undefined,
      execute: config.execute.bind(config, channel),
      async destroy() {
        if (config.destroy) {
          await config.destroy(channel);
        }
        await channel.destroy();
      },
    };
  }
}