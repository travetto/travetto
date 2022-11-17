import { d, lib } from '@travetto/doc';

export const text = d`
${d.Header()}

Boot is basic environment  awareness coupled with typescript bootstrapping for ${lib.Travetto} apps and libraries.  It has support for the following key areas:
${d.List(
  'Module Indexing',
  'Boot Loader Support',
  'Main Entry Bootstrapping', // TODO: Document
  'Console Management', // TODO: Document
  'Stacktrace Management',
  'Shutdown Management'
)}

${d.SubSection('Module Indexing')}
The bootstrap process will also produce an index of all source files, which allows for fast in-memory scanning.  This allows for all the automatic discovery that is used within the framework.

${d.Section('Boot Loader Support')}

During the lifecycle of an application, there is a need to handle different phases of execution. When executing a phase, the code will recursively find all ${d.Path('phase.<phase>.ts')} files under ${d.Path('node_modules/@travetto')}, and in the root of your project. The format of each phase handler is comprised of five main elements:

${d.List(
  d`The phase of execution, which is defined by the file name ${d.Path('phase.<phase>.ts')} ${d.List(
    'The key of the handler to be referenced for dependency management.'
  )}`,
  'The list of dependent handlers that the current handler depends on, if any.',
  'The list of handlers that should be dependent on the current handler, if any.',
  'The actual functionality to execute'
)}

An example would be something like ${d.Path('phase.init.ts')} in the ${mod.Config} module.  

${d.Code('Config phase init', '@travetto/config/support/phase.init.ts')}

${d.Section('Stacktrace Management')}
The built in stack filtering will remove duplicate or unnecessary lines, as well as filter out framework specific steps that do not aid in debugging.  The final result should be a stack trace that is concise and clear.  

From a test scenario:

${d.Code('Tracking asynchronous behavior', 'src/stack-test.ts')}

Will produce the following stack trace:

${d.Execute('Stack trace from async errors', 'src/stack-test.ts')}

The needed functionality cannot be loaded until ${d.Method('init.action')} executes, and so must be required only at that time.

${d.Section('Shutdown Management')}

Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on shutdown. Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers. The code overrides ${d.Method('process.exit')} to properly handle ${d.Input('SIGKILL')} and ${d.Input('SIGINT')}, with a default threshold of 3 seconds. In the advent of a ${d.Input('SIGTERM')} signal, the code exits immediately without any cleanup.

As a registered shutdown handler, you can do.
${d.Code('Registering a shutdown handler', 'src/shutdown.ts')}

`;