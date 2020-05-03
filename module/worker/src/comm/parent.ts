import { ChildProcess } from 'child_process';
import { ExecUtil } from '@travetto/boot';

import { ProcessCommChannel } from './channel';
import { CommUtil } from './util';

type ExecutionState = ReturnType<(typeof ExecUtil)['spawn']>;

// TODO: Document
export class ParentCommChannel<U = any> extends ProcessCommChannel<ChildProcess, U> {

  private complete: ExecutionState['result'];

  constructor(state: ExecutionState) {
    super(state.process);
    this.complete = state.result
      .finally(() => { delete this.proc; });
  }

  async destroy() {
    if (this.proc) {
      CommUtil.killSpawnedProcess(this.proc);
      await this.complete;
    }

    return super.destroy();
  }
}