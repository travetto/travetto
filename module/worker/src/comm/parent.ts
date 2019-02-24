import * as child_process from 'child_process';
import { ExecutionState, ExecutionResult } from '@travetto/exec';

import { CommEvent } from './types';
import { ProcessCommChannel } from './channel';
import { CommUtil } from './util';

export class ParentCommChannel<U extends CommEvent = CommEvent> extends ProcessCommChannel<child_process.ChildProcess, U> {

  private _complete: Promise<ExecutionResult>;

  constructor(state: ExecutionState) {
    super(state.process);
    this._complete = state.result
      .then(x => { delete this._proc; return x; });
  }

  async destroy() {
    if (this._proc) {
      CommUtil.killSpawnedProcess(this._proc);
      await this._complete;
    }

    super.destroy();
  }
}