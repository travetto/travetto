import { ExecUtil } from '@travetto/base';
import { Worker } from '@travetto/worker';

import { TestConsumer } from '../../src/consumer/types';
import { TestEvent } from '../../src/model/event';

export class TestWorker implements Worker<string> {

  static #id = 0;

  id = TestWorker.#id += 1;
  active = false;
  #consumer: TestConsumer;

  kill?: () => void;

  constructor(consumer: TestConsumer) {
    this.#consumer = consumer;
  }

  async destroy(): Promise<void> {
    this.kill?.();
    this.active = false;
  }

  async execute(folder: string): Promise<void> {
    try {
      this.active = true;
      const args = ['test', '-f', 'exec', '-c', '3'];
      const { process: proc, result } = ExecUtil.spawn('trv', args, { cwd: folder, stdio: [0, 'pipe', 2, 'ipc'], shell: false });
      const kill = this.kill = (): void => { proc.kill('SIGTERM'); };

      proc.on('message', (ev: TestEvent) => this.#consumer.onEvent(ev));
      proc.on('error', kill);
      await result;
    } finally {
      this.active = false;
    }
  }
}