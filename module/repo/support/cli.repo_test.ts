import os from 'os';

import { CliCommand, OptionConfig } from '@travetto/cli';
import { FileResourceProvider } from '@travetto/base';
import { PackageUtil, path } from '@travetto/manifest';

import { Git } from './bin/git';
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
    const modules = await (this.cmd.changed ? Git.findChangedModulesRecursive() : Repo.modules);

    const { TestConsumerRegistry } = await import('@travetto/test/src/consumer/registry');
    const { RunnableTestConsumer } = await import('@travetto/test/src/consumer/types/runnable');
    const { WorkPool, IterableWorkSet } = await import('@travetto/worker');
    const { TestWorker } = await import('./bin/test');

    const emitter = await TestConsumerRegistry.getInstance(this.cmd.format);
    const consumer = new RunnableTestConsumer(emitter);
    const pool = new WorkPool(() => new TestWorker(consumer), { max: this.cmd.concurrency });

    const folders = new Set(modules.map(x => x.rel));

    const globalTests = new FileResourceProvider([path.resolve('global-test')]);

    for (const pkgJson of await globalTests.query(f => f.endsWith('package.json'))) {
      const resolved = (await globalTests.describe(pkgJson)).path;
      const folder = path.dirname(resolved);
      const pkg = PackageUtil.readPackage(folder);
      for (const mod of modules) {
        if (pkg.dependencies?.[mod.name]) {
          folders.add(folder);
        }
      }
    }

    await pool.process(new IterableWorkSet(folders));
    process.exit(consumer.summarizeAsBoolean() ? 0 : 1);
  }
}