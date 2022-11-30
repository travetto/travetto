import os from 'os';

import { CliCommand, OptionConfig } from '@travetto/cli';
import { type TestEvent } from '@travetto/test';

import { ServiceRunner } from './bin/service';
import { Exec } from './bin/exec';

type Options = {
  mode: OptionConfig<'changed' | 'all'>;
  format: OptionConfig<string>;
  workers: OptionConfig<number>;
};

/**
 * Launch test framework and execute tests
 */
export class RepoTestCommand extends CliCommand<Options> {
  name = 'repo:test';

  getOptions(): Options {
    return {
      mode: this.choiceOption({ desc: 'Only test changed modules', def: 'changed', choices: ['all', 'changed'] }),
      format: this.option({ desc: 'Output format for test results', def: 'tap' }),
      workers: this.intOption({ desc: 'Number of tests to run concurrently', lower: 1, upper: 32, def: Math.min(4, os.cpus().length - 1) })
    };
  }

  async action(): Promise<void> {
    const { TestConsumerRegistry } = await import('@travetto/test/src/consumer/registry.js');
    const { RunnableTestConsumer } = await import('@travetto/test/src/consumer/types/runnable.js');

    const emitter = await TestConsumerRegistry.getInstance(this.cmd.format);
    const consumer = new RunnableTestConsumer(emitter);

    // Build all
    await Exec.build({ globalTests: true, mode: this.cmd.mode });

    // Ensure services are healthy
    await ServiceRunner.runService(['restart'], { stdio: 'ignore' });

    // Run test
    await Exec.parallel((folder) => {
      const { process: proc, ...result } = Exec.forCommand(
        folder, 'trv', ['test', '-f', 'exec', '-c', '3'],
        { stdio: [0, 'pipe', 2, 'ipc'], env: { TRV_MANIFEST: '' } }
      );
      proc.on('message', (ev: TestEvent) => consumer.onEvent(ev));
      return result;
    }, { mode: this.cmd.mode, globalTests: true, workers: this.cmd.workers });

    process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
  }
}