import { Execution } from './execution';
import { WorkerEvent } from './types';
import { IdleManager } from './idle';

export class WorkerClient<U extends WorkerEvent = WorkerEvent> extends Execution<U, NodeJS.Process> {
  private idle: IdleManager;

  constructor(private timeout?: number) {
    super(process);
  }

  init() {
    const res = super.init();
    if (res && this.timeout) {
      if (!this.idle) {
        this.idle = new IdleManager(this.timeout);
      }
      this._proc.on('message', () => this.idle.extend());
      this.idle.start();
    }

    return res;
  }

  kill() {
    super.kill();
    if (this.idle) {
      this.idle.stop();
      delete this.idle;
    }
  }
}