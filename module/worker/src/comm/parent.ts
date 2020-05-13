import { ChildProcess } from 'child_process';
import { ExecutionState, ExecUtil } from '@travetto/boot';

import { ProcessCommChannel } from './channel';

/**
 * Parent channel
 */
export class ParentCommChannel<U = any> extends ProcessCommChannel<ChildProcess, U> {

  private complete: ExecutionState['result'];

  constructor(state: ExecutionState) {
    super(state.process);
    this.complete = state.result
      .finally(() => { delete this.proc; });
  }

  /**
   * Kill self and child
   */
  async destroy() {
    if (this.proc) {
      ExecUtil.kill(this.proc);
      await this.complete;
    }

    return super.destroy();
  }
}