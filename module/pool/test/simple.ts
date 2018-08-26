import { ChildProcess } from 'child_process';

class ImageProcessor {
  active = false;
  proc: ChildProcess;

  kill() {
    this.proc.kill();
  }

  async convert(path: string) {
    this.active = true;
    try {
      // this.proc = ...convert ...
      await this.proc;
    } catch (e) {

    }
    this.active = false;
  }
}