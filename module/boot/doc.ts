import { d, lib, mod } from '@travetto/doc';

export const text = d`
${d.Header()}

Boot is basic environment  awareness coupled with typescript bootstrapping for ${lib.Travetto} apps and libraries.  It has support for the following key areas:
${d.List(
  'Application Bootstrapping',
  'Console Management',
  'Manifest Generation',
  'Module Indexing',
  'Lifecycle Support',
  'Stacktrace Management',
)}

${d.SubSection('Module Indexing')}
The bootstrap process will also produce an index of all source files, which allows for fast in-memory scanning.  This allows for all the automatic discovery that is used within the framework (and transpiling).


${d.List(
  d`${d.Input('timeout')} as the number of milliseconds the process can run before terminating and throwing an error`,
  d`${d.Input('quiet')} which suppresses all stdout/stderr output`,
  d`${d.Input('stdin')} as a string, buffer or stream to provide input to the program you are running;`,
  d`${d.Input('timeoutKill')} allows for registering functionality to execute when a process is force killed by timeout`
)}

${d.Section('Lifecycle Support')}

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

${d.Code('Tracking asynchronous behavior', 'doc/stack-test.ts')}

Will produce the following stack trace:

${d.Execute('Stack trace from async errors', 'doc/stack-test.ts')}

The needed functionality cannot be loaded until ${d.Method('init.action')} executes, and so must be required only at that time.

`;