import * as commander from 'commander';
import * as os from 'os';
import * as readline from 'readline';
import { FsUtil, ExecUtil } from '@travetto/boot';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * Launch test framework for monorepo and execute tests
 */
export class TestLernaPlugin extends BasePlugin {
  name = 'test:lerna';

  init(cmd: commander.Command) {
    return cmd
      .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', /^[1-32]$/, `${Math.min(4, os.cpus().length - 1)}`)
      .option('-m, --mode <mode>', 'Test mode', /^standard|extension$/, 'standard');
  }

  async action() {
    const child = ExecUtil.spawn('npx', [
      'lerna', '--no-sort',
      'exec', '--no-bail', '--stream', '--',
      'npx', 'trv', 'test', '-f', 'event', '-m', this._cmd.mode, '-c', '2'
    ], { shell: true, rawOutput: true, cwd: FsUtil.resolveUnix(__dirname, '..', '..') });

    const { RunnableTestConsumer } = await import('../src/consumer/types/runnable');
    const { TapEmitter } = await import('../src/consumer/types/tap');

    const tap = new TapEmitter();
    const consumer = new RunnableTestConsumer(tap!);

    readline.createInterface({ input: child.process.stdout!, output: process.stdout, terminal: false })
      .on('line', line => {
        const [, name, body] = line.match(/^(\S+):\s+(.*)\s*$/)!;
        try {
          tap.setNamespace(name);
          consumer.onEvent(JSON.parse(body));
        } catch {
          console!.error('Failed on', body);
        }
      })
      .on('close', () => consumer.summarize());

    child.process.stderr?.pipe(process.stderr);

    await child.result.catch(() => { });
  }
}