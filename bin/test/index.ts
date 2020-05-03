import * as readline from 'readline';
import { TapEmitter } from './emitter';

import { ExecUtil } from '../../module/boot/src/exec';

export async function run() {

  const child = ExecUtil.spawn('npx', [
    'lerna', '--no-sort', 'exec', '--no-bail',
    // '--concurrency', '1',
    '--ignore', '@travetto/*-app',
    '--ignore', '@travetto/cli',
    '--stream', '--',
    'npx', 'trv', 'test', '-f', 'event', '-c', '2'
  ], { shell: true, quiet: true });

  const emitter = new TapEmitter();

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

      try {
        emitter.onEvent(name, JSON.parse(body));
      } catch (e) {
        console.error('Failed on', body);
      }
    })
    .on('close', () => {
      emitter.summarize();
    });
}