#!/usr/bin/env node

// @ts-check
const { getEntry } = require('./common.js');

const help = () => [
  'npx trvc [command]',
  '',
  'Available Commands:',
  ' * start|watch                - Run the compiler in watch mode',
  ' * stop                       - Stop the compiler if running',
  ' * restart                    - Restart the compiler in watch mode',
  ' * build                      - Ensure the project is built and upto date',
  ' * clean                      - Clean out the output and compiler caches',
  ' * info                       - Retrieve the compiler information, if running',
  ' * event <log|progress|state> - Watch events in realtime as newline delimited JSON',
  ' * exec <file> [...args]      - Allow for compiling and executing an entrypoint file',
  ' * manifest --prod [output]   - Generate the project manifest',
].join('\n');

getEntry().then(async (ops) => {
  const [op, ...all] = process.argv.slice(2);
  const args = all.filter(x => !x.startsWith('-'));
  const flags = all.filter(x => x.startsWith('-'));

  switch (op) {
    case undefined:
    case 'help': return console.log(`\n${help()}\n`);
    case 'restart': return ops.restart();
    case 'stop': return ops.stop();
    case 'info': return ops.info().then(v => console.log(JSON.stringify(v, null, 2)));
    case 'event': return ops.events(args[0], v => {
      if (!process.stdout.write(`${JSON.stringify(v)}\n`)) {
        return new Promise(r => process.stdout.once('drain', r));
      }
    });
    case 'clean': return ops.clean();
    case 'manifest': return ops.manifest(args[0], flags.some(x => x === '--prod'));
    case 'exec': return ops.getLoader().then(v => v(args[0], all.slice(1)));
    case 'start':
    case 'watch': return ops.watch();
    case 'build': return ops.build();
    default: console.error(`Unknown trvc operation: ${op}\n`); return console.error(help());
  }
});