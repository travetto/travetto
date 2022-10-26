import { ExecUtil, ExecutionState } from '@travetto/base';
import { Worker, WorkPool, IterableWorkSet, ManualAsyncIterator } from '@travetto/worker';

class ImageProcessor implements Worker<string> {
  active = false;
  proc: ExecutionState;

  get id(): number | undefined {
    return this.proc.process.pid;
  }

  async destroy(): Promise<void> {
    this.proc.process.kill();
  }

  async execute(path: string): Promise<void> {
    this.active = true;
    try {
      this.proc = ExecUtil.spawn('convert images', [path]);
      await this.proc;
    } catch {
      // Do nothing
    }
    this.active = false;
  }
}

export class ImageCompressor extends WorkPool<string, ImageProcessor> {

  pendingImages = new ManualAsyncIterator<string>();

  constructor() {
    super(async () => new ImageProcessor());
  }

  begin(): void {
    this.process(new IterableWorkSet(this.pendingImages));
  }

  convert(...images: string[]): void {
    this.pendingImages.add(images);
  }
}