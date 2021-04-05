import { d, mod, lib } from '@travetto/doc';

import { AppError } from './src/error';
import { Util } from './src/util';

const UtilLink = d.Ref(Util.name, 'src/util.ts');
const AppErrorLink = d.Ref(AppError.name, 'src/error.ts');
const ResourceManagerLink = d.Ref('ResourceManager', 'src/resource.ts');

export const text = d`
${d.Header()}

Base is the foundation of all ${lib.Travetto} applications.  It is intended to be a minimal application set, as well as support for commonly shared functionality. It has support for the following key areas:

${d.List(
  'Application Manifest',
  'File Operations',
  'Resource Management',
  'Lifecycle Support',
  'Shutdown Management',
  'Standard Error Support',
  'General Utilities'
)}

${d.Section('Application Manifest')}
The framework provides basic environment information, e.g. in prod/test/dev.  This is useful for runtime decisions.  This is primarily used by the framework, but can prove useful to application developers 
as well. The information that is available is:

${d.List(
  d`${d.Field('env.prod')}- Determines if app is in prod mode.  A ${d.Input('boolean')} flag that should indicate a production run.`,
  d`${d.Field('env.name')} - The environment name.  Will usually be one of ${d.Input('dev')}, ${d.Input('test')}, or ${d.Input('prod')}.  Can be anything that is passed in.`,
  d`${d.Field('env.profiles: Set<string>')} - Specific application profiles that have been activated.  This is useful for indicating different configuration or run states.`,
  d`${d.Field('env.debug')} - Simple logging flag.  This ${d.Input('boolean')} flag will enable or disable logging at various levels. By default ${d.Input('debug')} is on in non-${d.Input('prod')}.`,
  d`${d.Field('env.resources: string[]')} - Redource folders.  Search paths for resolving resouce requests via ${ResourceManagerLink}`,
  d`${d.Field('source.local: string[]')} - Local source folders for transpiling.  Does not extend to installed modules.`,
  d`${d.Field('source.common: string[]')} - Common source folders for transpiling. Includes installed modules.`,
  d`${d.Method('hasProfile(p: string): boolean;')} - Test whether or not a profile is active.`,
)}

${d.Section('File Operations')}
The framework does a fair amount of file system scanning to auto - load files. It also needs to have knowledge of what files are available. The framework provides a simple and performant functionality for recursively finding files. This functionality leverages regular expressions in lieu of glob pattern matching(this is to minimize overall code complexity).

A simple example of finding specific ${d.Path('.config')} files in your codebase:

${d.Code('Looking for all .config files with the prefix defined by svc', 'doc/find.ts')}

${d.Section('Resource Management')}

Resource management, loading of files, and other assets at runtime is a common pattern that the ${ResourceManagerLink} encapsulates. It provides the ability to add additional search paths, as well as resolve resources by searching in all the registerd paths.

${d.Code('Finding Images', 'doc/image.ts')}

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

${d.Section('Shutdown Management')}

Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on shutdown. Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers. The code overrides ${d.Method('process.exit')} to properly handle ${d.Input('SIGKILL')} and ${d.Input('SIGINT')}, with a default threshold of 3 seconds. In the advent of a ${d.Input('SIGTERM')} signal, the code exits immediately without any cleanup.

As a registered shutdown handler, you can do.
${d.Code('Registering a shutdown handler', 'doc/shutdown.ts')}

${d.Section('Standard Error Support')}

While the framework is 100 % compatible with standard ${d.Input('Error')} instances, there are cases in which additional functionality is desired. Within the framework we use ${AppErrorLink} (or its derivatives) to represent framework errors. This class is available for use in your own projects. Some of the additional benefits of using this class is enhanced error reporting, as well as better integration with other modules (e.g. the ${mod.Rest} module and HTTP status codes).  

The ${AppErrorLink} takes in a message, and an optional payload and / or error classification. The currently supported error classifications are:
${d.List(
  d`${d.Input('general')} - General purpose errors`,
  d`${d.Input('system')} - Synonym for ${d.Input('general')}`,
  d`${d.Input('data')} - Data format, content, etc are incorrect. Generally correlated to bad input.`,
  d`${d.Input('permission')} - Operation failed due to lack of permissions`,
  d`${d.Input('auth')} - Operation failed due to lack of authentication`,
  d`${d.Input('missing')} - Resource was not found when requested`,
  d`${d.Input('timeout')} - Operation did not finish in a timely manner`,
  d`${d.Input('unavailable')} - Resource was unresponsive`,
)}


${d.SubSection('Stacktrace')}
The built in stack filtering will remove duplicate or unnecessary lines, as well as filter out framework specific steps that do not aid in debugging.  The final result should be a stack trace that is concise and clear.  

From a test scenario:

${d.Code('Tracking asynchronous behavior', 'doc/stack-test.ts')}

Will produce the following stack trace:

${d.Execute('Stack trace from async errors', 'doc/stack-test.ts')}

The needed functionality cannot be loaded until ${d.Method('init.action')} executes, and so must be required only at that time.

${d.Section('General Utilities')}
Simple functions for providing a minimal facsimile to ${lib.Lodash}, but without all the weight. Currently ${UtilLink} includes:

${d.List(
  d`${d.Method('isPrimitive(el)')} determines if ${d.Input('el')} is a ${d.Input('string')}, ${d.Input('boolean')}, ${d.Input('number')} or ${d.Input('RegExp')}`,
  d`${d.Method('isPlainObject(obj)')} determines if the obj is a simple object`,
  d`${d.Method('isFunction(o)')} determines if ${d.Input('o')} is a simple ${d.Input('Function')}`,
  d`${d.Method('isClass(o)')} determines if ${d.Input('o')} is a class constructor`,
  d`${d.Method('isSimple(a)')} determines if ${d.Input('a')} is a simple value`,
  d`${d.Method('deepAssign(a, b, mode ?)')} which allows for deep assignment of ${d.Input('b')} onto ${d.Input('a')}, the ${d.Input('mode')} determines how aggressive the assignment is, and how flexible it is.  ${d.Input('mode')} can have any of the following values: ${d.List(
    d`${d.Input('loose')}, which is the default is the most lenient. It will not error out, and overwrites will always happen`,
    d`${d.Input('coerce')}, will attempt to force values from ${d.Input('b')} to fit the types of ${d.Input('a')}, and if it can't it will error out`,
    d`${d.Input('strict')}, will error out if the types do not match`,
  )}`,
  d`${d.Method('uuid(len: number)')} generates a simple uuid for use within the application.`
)}

${d.Section('CLI - build')} 

${d.Execute('Build usage', 'trv', ['build', '--help'])}

This command line operation pre-compiles all of the application source code.  You can target the output location as well, which is useful in conjunction with ${d.Field('process.env.TRV_CACHE')} for relocating the compiled files.

${d.Section('CLI - clean')}

The module provides the ability to clear the compilation cache to handle any inconsistencies that may arise.

${d.Execute('Clean operation', 'trv', ['clean', '--help'])}
`;