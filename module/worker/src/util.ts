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
    { args, opts, handlers }: {
      args?: string[];
      opts?: ExecutionOptions;
      handlers: {
        init?: (channel: ParentCommChannel) => Promise<any>;
        execute: (channel: ParentCommChannel, input: X) => Promise<any>;
        destroy?: (channel: ParentCommChannel) => Promise<any>;
      };
    }
  ): Worker<X> {
    const channel = new ParentCommChannel(
      ExecUtil.fork(command, args, {
        quiet: true,
        ...(opts ?? {})
      })
    );
    return {
      get id() { return channel.id; },
      get active() { return channel.active; },
      init: handlers.init ? handlers.init.bind(handlers, channel) : undefined,
      execute: handlers.execute.bind(handlers, channel),
      async destroy() {
        if (handlers.destroy) {
          await handlers.destroy(channel);
        }
        await channel.destroy();
      },
    };
  }
}