export class IdleManager {
  private timer: NodeJS.Timer;

  constructor(private timeout: number) { }

  quit() {
    process.exit(0);
  }

  extend() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    if (this.timeout) {
      this.timer = setTimeout(this.quit, this.timeout);
      this.timer.unref();
    }
  }
}