import * as os from 'os';
import * as fs from 'fs/promises';

import { CliCommand, OptionConfig } from '@travetto/cli';
import * as path from '@travetto/path';

type Options = {
  format: OptionConfig<string>;
  concurrency: OptionConfig<number>;
  mode: OptionConfig<'scan' | 'raw'>
};

async function findAllModules(seed: string[]): Promise<string[]> {
  const stack: string[] = [...seed.map(x => path.resolve(x))];
  const modules: string[] = [];
  while (stack.length) {
    const top = stack.shift()!;
    for (const el of await fs.readdir(top)) {
      if (el === 'node_modules' || el.startsWith('.')) {
        continue;
      } else if ((await fs.stat(`${top}/${el}`)).isDirectory()) {
        stack.push(`${top}/${el}`);
      } else if (el === 'package.json' && (await fs.stat(`${top}/test`).catch(() => { }))?.isDirectory()) {
        modules.push(top);
      }
    }
  }
  return modules;
}


/**
 * Launch test framework and execute tests
 */
export class TestAllCommand extends CliCommand<Options> {
  name = 'test:all';

  getOptions(): Options {
    return {
      format: this.option({ desc: 'Output format for test results', def: 'tap' }),
      mode: this.option({ desc: 'Mode of how to treat folder inputs', def: 'raw' }),
      concurrency: this.intOption({ desc: 'Number of tests to run concurrently', lower: 1, upper: 32, def: Math.min(4, os.cpus().length - 1) })
    };
  }

  getArgs(): string {
    return '[folders...]';
  }

  async action(folders: string[]): Promise<void> {
    if (this.cmd.mode === 'scan') {
      folders = await findAllModules(folders ?? [process.cwd()]);
    }

    console.error('Starting tests', folders);

    const { TestConsumerRegistry } = await import('../src/consumer/registry');
    const { RunnableTestConsumer } = await import('../src/consumer/types/runnable');
    const { WorkPool, IterableWorkSet } = await import('@travetto/worker');
    const { TestWorker } = await import('./bin/all-worker');

    await TestConsumerRegistry.manualInit();

    const emitter = await TestConsumerRegistry.getInstance(this.cmd.format);
    const consumer = new RunnableTestConsumer(emitter);
    const pool = new WorkPool(() => new TestWorker(consumer), { max: this.cmd.concurrency })
    await pool.process(new IterableWorkSet(folders));
    process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
  }
}