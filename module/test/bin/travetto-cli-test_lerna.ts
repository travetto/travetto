import * as os from 'os';
import { CliUtil } from '@travetto/cli/src/util';
import { FsUtil, ExecUtil } from '@travetto/boot';
import { getTapConsumer, eventStreamSource } from './lib/consumer';

/**
 * Launch test framework for monorepo and execute tests
 */
export function init() {
  return CliUtil.program.command('test:lerna')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, `${Math.min(4, os.cpus().length - 1)}`)
    .action(async (args, cmd) => {
      const child = ExecUtil.spawn('npx', [
        'lerna', '--no-sort', 'exec', '--no-bail',
        // '--concurrency', '1',
        '--ignore', '@travetto/*-app', // @line-if $TRV_DEV
        '--ignore', '@travetto/cli',  // @line-if $TRV_DEV
        '--stream', '--',
        'npx', 'trv', 'test', '-f', 'event', '-c', '2'
      ], { shell: true, quiet: true, cwd: FsUtil.resolveUnix(__dirname, '..', '..') });

      const { RunnableTestConsumer } = await import('../src/consumer/types/runnable');
      const tap = await getTapConsumer();
      const consumer = new RunnableTestConsumer(tap!);

      eventStreamSource(child.process.stdout!, (name, ev) => {
        tap.setNamespace(name);
        consumer.onEvent(ev);
      }, () => consumer.summarize());

      await child.result.catch(console.error);
    });
}