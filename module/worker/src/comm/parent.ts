import { ChildProcess } from 'child_process';

import { ExecutionState, ShutdownManager } from '@travetto/base';

import { ProcessCommChannel } from './channel';

/**
 * Parent channel
 */
export class ParentCommChannel<U = unknown> extends ProcessCommChannel<ChildProcess, U> {

  #complete: ExecutionState['result'];

  constructor(state: ExecutionState) {
    super(state.process);
    ShutdownManager.onShutdown(this, { close: () => this.destroy() });
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