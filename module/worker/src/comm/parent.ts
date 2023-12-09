import { ChildProcess } from 'node:child_process';

import { ShutdownManager, ExecutionState } from '@travetto/base';

import { ProcessCommChannel } from './channel';

/**
 * Parent channel
 */
export class ParentCommChannel<U = unknown> extends ProcessCommChannel<ChildProcess, U> {

  #complete: ExecutionState['result'];

  constructor(state: ExecutionState) {
    super(state.process);
    ShutdownManager.onGracefulShutdown(() => this.destroy(), this);
    this.#complete = state.result
      .finally(() => { this.proc = undefined; });
  }

  /**
   * Kill self and child
   */
  override async destroy(): Promise<void> {
    const res = super.destroy();
    await this.#complete;
    return await res;
  }
}