
import { ExecUtil } from '@travetto/base';
import { ModuleIndex } from '@travetto/boot';
import { CliModuleUtil } from '@travetto/cli/src/module';
import { IterableWorkSet, Worker, WorkPool } from '@travetto/worker';

import { TestConsumerRegistry } from '../../src/consumer/registry';
import { RunnableTestConsumer } from '../../src/consumer/types/runnable';
import { TestEvent } from '../../src/model/event';

let id = 0;

export async function runWorkspace(format: string, workers: number): Promise<void> {

  const emitter = await TestConsumerRegistry.getInstance(format);
  const consumer = new RunnableTestConsumer(emitter);

  // Build all
  await ExecUtil.spawn('trv', ['build'], { stdio: 'ignore' }).result;

  // Ensure services are healthy
  if (ModuleIndex.hasModule('@travetto/command')) {
    await ExecUtil.spawn('trv', ['command:service', 'start'], { stdio: 'ignore' }).result;
  }

  // Run test
  const folders = (await CliModuleUtil.findModules('changed'))
    .map(x => x.workspaceRelative);

  const pool = new WorkPool(async () => {
    const worker: Worker<string> = {
      id: id += 1,
      active: false,
      destroy: async () => { },
      execute(folder: string) {
        this.active = true;
        const res = ExecUtil.spawn('trv', ['test', '-f', 'exec', '-c', '3'], {
          cwd: folder,
          stdio: [0, 'pipe', 2, 'ipc'],
          env: { TRV_MANIFEST: '' }
        });
        res.process.on('message', (ev: TestEvent) => consumer.onEvent(ev));
        this.destroy = async (): Promise<void> => { res.process.kill('SIGKILL'); };
        return res.result.finally(() => this.active = false);
      },
    };
    return worker;
  }, { max: workers ?? undefined });

  const work = new IterableWorkSet(folders);
  await pool.process(work);
  process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
}