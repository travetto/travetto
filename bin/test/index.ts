import * as readline from 'readline';
import * as child_process from 'child_process';
import { TapEmitter } from './emitter';

export async function run() {

  child_process.spawnSync('npx', [
    'lerna', '--no-bail', 'exec', '--parallel', '--',
    'npx', 'travetto', 'clean'
  ], { shell: true });

  // Rewrite
  const child = child_process.spawn('npx', [
    'lerna', '--concurrency', '4', 'exec', '--no-bail', '--stream', '--',
    'npx', 'travetto', 'test', '-f', 'event', '-c', '1'
  ], { shell: true });

  const emitter = new TapEmitter();

  const rl = readline.createInterface({
    input: child.stdout,
    output: process.stdout,
    terminal: false
  });

  rl
    .on('line', function (line) {
      const space = line.indexOf(' ');
      const body = line.substring(space + 1);
      const name = line.substring(0, space - 1);
      try {
        emitter.onEvent(name, JSON.parse(body));
      } catch (e) {
        console.error(line);
        console.error(e);
        process.exit(1);
      }
    })
    .on('close', () => {
      emitter.summarize();

      // Clean up
      child_process.spawnSync('npx', [
        'lerna', '--no-bail', 'exec', '--parallel', '--',
        'npx', 'travetto', 'clean'
      ], { shell: true });
    });
}