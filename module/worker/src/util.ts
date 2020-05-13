import { ExecUtil, ExecutionOptions, } from '@travetto/boot';
import { ParentCommChannel } from './comm/parent';
import { Worker } from './pool';

/**
 * Spawned worker
 */
export class WorkUtil {
  /**
   * Create a process channel worker from a given spawn config
   */
  static spawnedWorker<X>(
    command: string,
    args: string[],
    opts: ExecutionOptions,
    config: {
      init?: (channel: ParentCommChannel) => Promise<any>;
      execute: (channel: ParentCommChannel, input: X) => Promise<any>;
      destroy?: (channel: ParentCommChannel) => Promise<any>;
    }
  ): Worker<X> {
    const channel = new ParentCommChannel(
      ExecUtil.fork(command, args, opts)
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