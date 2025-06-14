#!/usr/bin/env node
const help = `
trvc [command]

Available Commands:
 * start|watch                - Run the compiler in watch mode
 * stop                       - Stop the compiler if running
 * restart                    - Restart the compiler in watch mode
 * build                      - Ensure the project is built and upto date
 * clean                      - Clean out the output and compiler caches
 * info                       - Retrieve the compiler information, if running
 * event <log|progress|state> - Watch events in realtime as newline delimited JSON
 * exec <file> [...args]      - Allow for compiling and executing an entrypoint file
 * manifest --prod [output]   - Generate the project manifest
`;

const toJson = (/** @type {number} */ depth) => v => process.stdout.write(`${JSON.stringify(v, undefined, depth)}\n`) ||
  new Promise(r => process.stdout.once('drain', r));

require('./entry.common.js').load(ops => {
  const [op, ...all] = process.argv.slice(2);
  const args = all.filter(x => !x.startsWith('-'));

  switch (op) {
    case undefined:
    case 'help': return console.log(help);
    case 'info': return ops.info().then(toJson(2));
    case 'event': return ops.events(args[0], toJson(0));
    case 'manifest': return ops.manifest(args[0], all.some(x => x === '--prod'));
    case 'exec': return ops.exec(args[0], all.slice(1));
    case 'build': return ops.build();
    case 'clean': return ops.clean();
    case 'start':
    case 'watch': return ops.watch();
    case 'stop': return ops.stop();
    case 'restart': return ops.restart();
    default: console.error(`\nUnknown trvc operation: ${op}\n${help}`);
  }
});