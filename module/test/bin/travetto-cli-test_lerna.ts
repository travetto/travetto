import * as os from 'os';
import * as readline from 'readline';
import { CliUtil } from '@travetto/cli/src/util';
import { FsUtil, ExecUtil } from '@travetto/boot';

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
      const { TapEmitter } = await import('../src/consumer/types/tap');

      const tap = new TapEmitter();
      const consumer = new RunnableTestConsumer(tap!);

      readline.createInterface({ input: child.process.stdout!, output: process.stdout, terminal: false })
        .on('line', line => {
          const [name, body] = line.match(/^(\S+)\s+(.*)\s*$/)!;
          try {
            tap.setNamespace(name);
            consumer.onEvent(JSON.parse(body));
          } catch {
            console!.error('Failed on', body);
          }
        })
        .on('close', () => consumer.summarize());

      await child.result.catch(() => { });
    });
}