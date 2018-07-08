import { QueueDataSource, ConcurrentPool } from '..';
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
      this.proc = ...convert ...
      await this.proc;
    } catch (e) {

    }
    this.active = false;
  }
}

class ImageCompressor {
  pendingImages: QueueDataSource<string>;

  pool = new ConcurrentPool(async () => {
    return new ImageProcessor();
  });

  constructor() {
    this.pool.process(this.pendingImages, async (inp, exe) => {
      exe.convert(inp);
    });
  }

  convert(...images: string[]) {
    for (const img of images) {
      this.pendingImages.enqueue(img);
    }
  }
}