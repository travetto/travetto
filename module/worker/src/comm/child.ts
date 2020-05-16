import { ProcessCommChannel } from './channel';

/**
 * Child channel, communicates only to parent
 */
export class ChildCommChannel<U = any> extends ProcessCommChannel<NodeJS.Process, U> {
  idleTimer: NodeJS.Timer | undefined;

  constructor(private timeout?: number) {
    super(process);

    if (timeout) {
      process.on('message', () => this.idle());
      this.idle();
    }
  }

  /**
   * Kill self and stop the keep alive
   */
  async destroy() {
    await super.destroy();
    this.idle(0);
  }

  /**
   * Control the idle behavior of the process
   */
  async idle(timeout: number | undefined = this.timeout) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    if (timeout) {
      this.idleTimer = setTimeout(() => process.exit(0), timeout).unref();
    }
  }
}