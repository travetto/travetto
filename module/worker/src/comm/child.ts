import { IdleManager } from '../idle';
import { ProcessCommChannel } from './channel';

export class ChildCommChannel<U = any> extends ProcessCommChannel<NodeJS.Process, U> {
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