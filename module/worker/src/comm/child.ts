import { IdleManager } from '../idle';
import { CommEvent } from './types';
import { ProcessCommChannel } from './channel';

export class ChildCommChannel<U extends CommEvent = CommEvent> extends ProcessCommChannel<NodeJS.Process, U> {
  idle: IdleManager;

  constructor(timeout?: number) {
    super(process);

    if (timeout) {
      this.idle = new IdleManager(timeout);
      process.on('message', () => this.idle.extend());
      this.idle.start();
    }
  }

  async destroy() {
    await super.destroy();
    if (this.idle) {
      this.idle.stop();
    }
  }
}