// TODO: Document
export class IdleManager {

  private timer: NodeJS.Timer;

  constructor(private timeout: number) { }

  quit() {
    process.exit(0);
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      delete this.timer;
    }
  }

  start() {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(this.quit, this.timeout);
    this.timer.unref();
  }

  extend() {
    this.stop();
    this.start();
  }
}