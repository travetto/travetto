import os from 'os';

import { CliCommand, OptionConfig } from '@travetto/cli';
import { type TestEvent } from '@travetto/test';
import { PackageUtil } from '@travetto/manifest';

import { CmdConfig, RepoWorker } from './bin/work';
import { Repo } from './bin/repo';

type Options = {
  changed: OptionConfig<boolean>;
  format: OptionConfig<string>;
  concurrency: OptionConfig<number>;
};

/**
 * Launch test framework and execute tests
 */
export class RepoTestCommand extends CliCommand<Options> {
  name = 'repo:test';

  getOptions(): Options {
    return {
      changed: this.boolOption({ desc: 'Only test changed modules', def: true }),
      format: this.option({ desc: 'Output format for test results', def: 'tap' }),
      concurrency: this.intOption({ desc: 'Number of tests to run concurrently', lower: 1, upper: 32, def: Math.min(4, os.cpus().length - 1) })
    };
  }

  async action(): Promise<void> {
    const { TestConsumerRegistry } = await import('@travetto/test/src/consumer/registry');
    const { RunnableTestConsumer } = await import('@travetto/test/src/consumer/types/runnable');

    const emitter = await TestConsumerRegistry.getInstance(this.cmd.format);
    const consumer = new RunnableTestConsumer(emitter);

    const baseConfig: CmdConfig = {
      extraFolders: (await Repo.root).pkg.travettoRepo?.globalTests,
      extraFilter: (extra, folderSet) => {
        try {
          const pkg = PackageUtil.readPackage(extra);
          for (const [, { name }] of folderSet) {
            if (name in (pkg.dependencies ?? {})) {
              return true;
            }
          }
        } catch { }
        return false;
      },
      mode: this.cmd.changed ? 'changed' : 'all',
      workers: this.cmd.concurrency
    };

    // Build all
    await RepoWorker.exec(
      folder => RepoWorker.forCommand(folder, 'trv', [], [0, 'ignore', 'pipe']),
      { ...baseConfig, workers: 4 }
    );

    // Run test
    await RepoWorker.exec((folder) => {
      const { process: proc, ...result } = RepoWorker.forCommand(
        folder, 'trv', ['test', '-f', 'exec', '-c', '3'], [0, 'pipe', 2, 'ipc']
      );
      proc.on('message', (ev: TestEvent) => consumer.onEvent(ev));
      return result;
    }, baseConfig);

    process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
  }
}