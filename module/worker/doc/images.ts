import { ExecUtil, ExecutionState } from '@travetto/base';
import { Worker, WorkPool, WorkQueue } from '@travetto/worker';

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

export class ImageCompressor {

  changes: AsyncIterable<unknown>;
  pendingImages = new WorkQueue<string>();

  begin(): void {
    this.changes ??= WorkPool.runStream(() => new ImageProcessor(), this.pendingImages);
  }

  convert(...images: string[]): void {
    this.pendingImages.addAll(images);
  }
}