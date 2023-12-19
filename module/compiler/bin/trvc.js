#!/usr/bin/env -S NODE_OPTIONS='--enable-source-maps' '--disable-proto=delete' node

// @ts-check
import { getEntry } from './common.js';

const help = () => [
  'npx trvc [command]',
  '',
  'Available Commands:',
  ' * start|watch               - Run the compiler in watch mode',
  ' * stop                      - Stop the compiler if running',
  ' * restart                   - Restart the compiler in watch mode',
  ' * build                     - Ensure the project is built and upto date',
  ' * clean                     - Clean out the output and compiler caches',
  ' * info                      - Retrieve the compiler information, if running',
  ' * manifest [output] [prod]  - Generate the project manifest',
].join('\n');

getEntry().then(async (ops) => {
  const [op, ...args] = process.argv.slice(2);
  const baseArgs = args.filter(x => !x.startsWith('-'));

  switch (op) {
    case undefined:
    case 'help': return console.log(`\n${help()}\n`);
    case 'restart': return ops.stop().then(() => ops.compile('watch'));
    case 'stop': return ops.stop();
    case 'info': return ops.info().then(v => console.log(JSON.stringify(v, null, 2)));
    case 'clean': return ops.clean();
    case 'manifest': return ops.manifest(baseArgs[0], /prod/i.test(baseArgs[1] ?? ''));
    case 'start': return ops.compile('watch');
    case 'watch':
    case 'build': return ops.compile(op);
    default: console.error(`Unknown trvc operation: ${op}\n`); return console.error(help());
  }
});