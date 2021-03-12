import { ExecUtil, ExecutionOptions } from '@travetto/boot';

import { ParentCommChannel } from './comm/parent';
import { Worker } from './pool';

/**
 * Spawned worker
 */
export class WorkUtil {
  /**
   * Create a process channel worker from a given spawn config
   */
  static spawnedWorker<V, X>(
    command: string,
    { args, opts, handlers }: {
      args?: string[];
      opts?: ExecutionOptions;
      handlers: {
        init?: (ch: ParentCommChannel<V>) => Promise<unknown | void>;
        execute: (ch: ParentCommChannel<V>, input: X) => Promise<unknown | void>;
        destroy?: (ch: ParentCommChannel<V>) => Promise<unknown | void>;
      };
    }
  ): Worker<X> {
    const channel = new ParentCommChannel<V>(
      ExecUtil.forkMain(command, args, { ...opts })
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