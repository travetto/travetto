import { ExecutionState } from '@travetto/boot';

import { ParentCommChannel } from './comm/parent';
import { Worker } from './pool';

type Simple<V> = (ch: ParentCommChannel<V>) => Promise<unknown | void>;
type Param<V, X> = (ch: ParentCommChannel<V>, input: X) => Promise<unknown | void>;

const empty = async (): Promise<void> => { };

/**
 * Spawned worker
 */
export class WorkUtil {
  /**
   * Create a process channel worker from a given spawn config
   */
  static spawnedWorker<V, X>(
    worker: () => ExecutionState,
    init: Simple<V>,
    execute: Param<V, X>,
    destroy: Simple<V> = empty): Worker<X> {
    const channel = new ParentCommChannel<V>(worker());
    return {
      get id(): number | undefined { return channel.id; },
      get active(): boolean { return channel.active; },
      init: () => init(channel),
      execute: inp => execute(channel, inp),
      async destroy(): Promise<void> {
        await destroy(channel);
        await channel.destroy();
      },
    };
  }
}