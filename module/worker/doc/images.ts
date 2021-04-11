import { ExecUtil, ExecutionState } from '@travetto/boot';
import { Worker, WorkPool, IterableWorkSet, DynamicAsyncIterator } from '@travetto/worker';

class ImageProcessor implements Worker<string> {
  active = false;
  proc: ExecutionState;

  get id() {
    return this.proc.process.pid;
  }

  async destroy() {
    this.proc.process.kill();
  }

  async execute(path: string) {
    this.active = true;
    try {
      this.proc = ExecUtil.spawn('convert images', [path]);
      await this.proc;
    } catch (e) {

    }
    this.active = false;
  }
}

export class ImageCompressor extends WorkPool<string, ImageProcessor> {

  pendingImages = new DynamicAsyncIterator<string>();

  constructor() {
    super(async () => new ImageProcessor());
  }

  begin() {
    this.process(new IterableWorkSet(this.pendingImages));
  }

  convert(...images: string[]) {
    this.pendingImages.add(images);
  }
}