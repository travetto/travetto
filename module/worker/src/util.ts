import { SpawnConfig } from './comm/types';
import { ParentCommChannel } from './comm/parent';
import { CommUtil } from './comm/util';
import { Worker } from './pool';

export class WorkUtil {
  static spawnedWorker<X>(
    config: SpawnConfig & {
      execute: (channel: ParentCommChannel, input: X) => any,
      destroy?: (channel: ParentCommChannel) => any,
      init?: (channel: ParentCommChannel) => any,
    }
  ): Worker<X> {
    const channel = new ParentCommChannel(
      CommUtil.spawnProcess(config)
    );
    return {
      get id() { return channel.id; },
      get active() { return channel.active; },
      destroy: async () => {
        if (config.destroy) {
          await config.destroy(channel);
        }
        await channel.destroy();
      },
      init: () => config.init ? config.init(channel) : undefined,
      execute: (inp: X) => config.execute(channel, inp)
    };
  }
}