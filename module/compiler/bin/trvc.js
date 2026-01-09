#!/usr/bin/env node
// @ts-check
import '@travetto/manifest/bin/hook.js';
import operations from '@travetto/compiler/support/entry.main.ts';

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

const [operation, ...all] = process.argv.slice(2);
const args = all.filter(arg => !arg.startsWith('-'));

switch (operation) {
  case undefined:
  case 'help': console.log(help); break;
  case 'info': operations.infoStdout(); break;
  case 'event': operations.eventsStdout(args[0]); break;
  case 'manifest': operations.manifest(args[0], all.some(arg => arg === '--prod')); break;
  case 'exec': operations.exec(args[0], all.slice(1)); break;
  case 'build': operations.build(); break;
  case 'clean': operations.clean(); break;
  case 'start':
  case 'watch': operations.watch(); break;
  case 'stop': operations.stop(); break;
  case 'restart': operations.restart(); break;
  default: console.error(`\nUnknown trvc operation: ${operation}\n${help}`);
}