
import { ProcessCommChannel } from './channel';
import { SystemUtil } from '@travetto/base/src/internal/system';

/**
 * Child channel, communicates only to parent
 */
export class ChildCommChannel<U = any> extends ProcessCommChannel<NodeJS.Process, U> {
  idle: ReturnType<(typeof SystemUtil)['idle']>;

  constructor(timeout?: number) {
    super(process);

    if (timeout) {
      this.idle = SystemUtil.idle(timeout, () => process.exit(0));
      process.on('message', () => this.idle.restart());
      this.idle.start();
    }
  }

  /**
   * Kill self and stop the keep alive
   */
  async destroy() {
    await super.destroy();
    if (this.idle) {
      this.idle.stop();
    }
  }
}