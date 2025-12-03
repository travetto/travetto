#!/usr/bin/env node
const help = `
npx trvc [command]

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

const toJson = (/** @type {number} */ depth) => value => process.stdout.write(`${JSON.stringify(value, undefined, depth)}\n`) ||
  new Promise(resolve => process.stdout.once('drain', resolve));

require('./entry.common.js').load(operations => {
  const [operation, ...all] = process.argv.slice(2);
  const args = all.filter(arg => !arg.startsWith('-'));

  switch (operation) {
    case undefined:
    case 'help': return console.log(help);
    case 'info': return operations.info().then(toJson(2));
    case 'event': return operations.events(args[0], toJson(0));
    case 'manifest': return operations.manifest(args[0], all.some(arg => arg === '--prod'));
    case 'exec': return operations.exec(args[0], all.slice(1));
    case 'build': return operations.build();
    case 'clean': return operations.clean();
    case 'start':
    case 'watch': return operations.watch();
    case 'stop': return operations.stop();
    case 'restart': return operations.restart();
    default: console.error(`\nUnknown trvc operation: ${operation}\n${help}`);
  }
});