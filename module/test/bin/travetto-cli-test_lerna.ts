import * as os from 'os';
import * as readline from 'readline';
import { CliUtil } from '@travetto/cli/src/util';
import { FsUtil, ExecUtil } from '@travetto/boot';
import { TestEvent } from '../src/model/event';

/**
 * Launch test framework for monorepo and execute tests
 */
export function init() {
  return CliUtil.program.command('test:lerna')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, `${Math.min(4, os.cpus().length - 1)}`)
    .action(async (args, cmd) => {
      const { TapEmitter } = await import('../src/consumer/types/tap');
      const { RunnableTestConsumer } = await import('../src/consumer/types/runnable');

      const child = ExecUtil.spawn('npx', [
        'lerna', '--no-sort', 'exec', '--no-bail',
        // '--concurrency', '1',
        '--ignore', '@travetto/*-app', // @line-if $TRV_DEV
        '--ignore', '@travetto/cli',  // @line-if $TRV_DEV
        '--stream', '--',
        'npx', 'trv', 'test', '-f', 'event', '-c', '2'
      ], { shell: true, quiet: true, cwd: FsUtil.resolveUnix(__dirname, '..', '..') });

      const tap = new TapEmitter();
      const consumer = new RunnableTestConsumer(tap);

      const rl = readline.createInterface({
        input: child.process.stdout!,
        output: process.stdout,
        terminal: false
      });

      rl
        .on('line', function (line) {
          const space = line.indexOf(' ');
          const body = line.substring(space + 1).trim();
          const name = line.substring(0, space - 1);

          let event: TestEvent | undefined;
          try {
            event = JSON.parse(body);
          } catch {
            console.error('Failed on', body);
          }

          if (event) {
            tap.setNamespace(name);
            consumer.onEvent(event);
          }
        })
        .on('close', () => {
          consumer.summarize();
        });

      await child.result.catch(console.error);
    });
}