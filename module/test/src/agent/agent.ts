import * as child_process from 'child_process';
import { fork } from '@travetto/util';
import { ForkedWorker } from '../worker';

export class Agent extends ForkedWorker<{ type: string } & any> {
  process: child_process.ChildProcess;
  completion: Promise<any>;

  stdout: string = '';
  stderr: string = '';

  constructor(public id: number, command: string) {
    super(command);
  }

  async init() {
    const res = super.init();

    if (res) {
      this.once('ready', e => this.sendEvent({ type: 'init' }));

      return new Promise<boolean>((resolve, reject) => {
        this.once('initComplete', () => resolve(true));
      });
    }

    return res;
  }

  clean() {
    super.clean();
    delete this.completion;
    this.stdout = '';
    this.stderr = '';
  }
}
