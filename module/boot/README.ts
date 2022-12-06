import { d, lib } from '@travetto/doc';

import { ModuleIndex } from './src/module-index';

const ConsoleManager = d.Ref('ConsoleManager', 'src/console.ts');

export const text = () => d`
${d.Header()}

Boot is basic environment  awareness coupled with typescript bootstrapping for ${lib.Travetto} apps and libraries.  It has support for the following key areas:
${d.List(
  'Module Indexing',
  'Main Entry Bootstrapping', // TODO: Document
  'Console Management', // TODO: Document
  'Shutdown Management'
)}

${d.SubSection('Module Indexing')}
The bootstrap process will also produce an index of all source files, which allows for fast in-memory scanning.  This allows for all the automatic discovery that is used within the framework.

${d.Section('Shutdown Management')}

Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on shutdown. Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers. The code overrides ${d.Method('process.exit')} to properly handle ${d.Input('SIGKILL')} and ${d.Input('SIGINT')}, with a default threshold of 3 seconds. In the advent of a ${d.Input('SIGTERM')} signal, the code exits immediately without any cleanup.

As a registered shutdown handler, you can do.
${d.Code('Registering a shutdown handler', 'doc/shutdown.ts')}

${d.Section('Console Management')}

This module provides logging functionality, built upon ${lib.Console} operations. 

The supported operations are:
${d.List(
  d`${d.Method('console.error')} which logs at the ${d.Input('ERROR')} level`,
  d`${d.Method('console.warn')} which logs at the ${d.Input('WARN')} level`,
  d`${d.Method('console.info')} which logs at the ${d.Input('INFO')} level`,
  d`${d.Method('console.debug')} which logs at the ${d.Input('DEBUG')} level`,
  d`${d.Method('console.log')} which logs at the ${d.Input('INFO')} level`,
)}

${d.Note(d`All other console methods are excluded, specifically ${d.Method('trace')}, ${d.Method('inspect')}, ${d.Method('dir')}, ${d.Method('time')}/${d.Method('timeEnd')}`)}


${d.Section('How Logging is Instrumented')}

All of the logging instrumentation occurs at transpilation time.  All ${d.Method('console.*')} methods are replaced with a call to a globally defined variable that delegates to the ${ConsoleManager}.  This module, hooks into the ${ConsoleManager} and receives all logging events from all files compiled by the ${lib.Travetto}.

A sample of the instrumentation would be:

${d.Code('Sample logging at various levels', 'doc/transpile.ts')}

${d.Code('Sample After Transpilation', ModuleIndex.resolveFileImport('@travetto/boot/doc/transpile.ts'), false, 'javascript')}


${d.SubSection('Filtering Debug')}

The ${d.Input('debug')} messages can be filtered using the patterns from the ${lib.Debug}.  You can specify wild cards to only ${d.Input('DEBUG')} specific modules, folders or files.  You can specify multiple, and you can also add negations to exclude specific packages.

${d.Terminal('Sample environment flags', `
# Debug
$ DEBUG=-@travetto/model npx trv run app
$ DEBUG=-@travetto/registry npx trv run app
$ DEBUG=@travetto/rest npx trv run app
$ DEBUG=@travetto/*,-@travetto/model npx trv run app
`)}

Additionally, the logging framework will merge ${lib.Debug} into the output stream, and supports the standard usage

${d.Terminal('Sample environment flags for standard usage', `
# Debug
$ DEBUG=express:*,@travetto/rest npx trv run rest
`)}


`;