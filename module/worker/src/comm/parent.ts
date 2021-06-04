import { ChildProcess } from 'child_process';

import { ExecutionState } from '@travetto/boot';
import { ShutdownManager } from '@travetto/base';

import { ProcessCommChannel } from './channel';

/**
 * Parent channel
 */
export class ParentCommChannel<U = unknown> extends ProcessCommChannel<ChildProcess, U> {

  #complete: ExecutionState['result'];

  constructor(state: ExecutionState) {
    super(state.process);
    ShutdownManager.onShutdown({ close: () => this.destroy() });
    this.#complete = state.result
      .finally(() => { this.proc = undefined; });
  }

  /**
   * Kill self and child
   */
  override async destroy() {
    const res = super.destroy();
    await this.#complete;
    return await res;
  }
}