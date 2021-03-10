import { doc as d, mod, Code, Section, List, inp, meth, SubSection, Ref, Execute, pth, lib, fld, Header } from '@travetto/doc';
import { AppError } from './src/error';
import { Util } from './src/util';
import { SystemUtil } from './src/internal/system';

const UtilLink = Ref(Util.name, 'src/util.ts');
const AppErrorLink = Ref(AppError.name, 'src/error.ts');
const ResourceManagerLink = Ref('ResourceManager', 'src/resource.ts');
const SystemUtilLink = Ref(SystemUtil.name, 'src/internal/system.ts');

export const text = d`
${Header()}

Base is the foundation of all ${lib.Travetto} applications.  It is intended to be a minimal application set, as well as support for commonly shared functionality. It has support for the following key areas:

${List(
  'Application Manifest',
  'File Operations',
  'Resource Management',
  'Lifecycle Support',
  'Shutdown Management',
  'Standard Error Support',
  'General Utilities'
)}

${Section('Application Manifest')}
The framework provides basic environment information, e.g. in prod/test/dev.  This is useful for runtime decisions.  This is primarily used by the framework, but can prove useful to application developers 
as well. The information that is available is:

${List(
  d`${fld`env.prod`}- Determines if app is in prod mode.  A ${inp`boolean`} flag that should indicate a production run.`,
  d`${fld`env.name`} - The environment name.  Will usually be one of ${inp`dev`}, ${inp`test`}, or ${inp`prod`}.  Can be anything that is passed in.`,
  d`${fld`env.profiles: Set<string>`} - Specific application profiles that have been activated.  This is useful for indicating different configuration or run states.`,
  d`${fld`env.debug`} - Simple logging flag.  This ${inp`boolean`} flag will enable or disable logging at various levels. By default ${inp`debug`} is on in non-${inp`prod`}.`,
  d`${fld`env.resources: string[]`} - Redource folders.  Search paths for resolving resouce requests via ${ResourceManagerLink}`,
  d`${fld`source.local: string[]`} - Local source folders for transpiling.  Does not extend to installed modules.`,
  d`${fld`source.common: string[]`} - Common source folders for transpiling. Includes installed modules.`,
  d`${meth`hasProfile(p: string): boolean;`} - Test whether or not a profile is active.`,
)}

${Section('File Operations')}
The framework does a fair amount of file system scanning to auto - load files. It also needs to have knowledge of what files are available. The framework provides a simple and performant functionality for recursively finding files. This functionality leverages regular expressions in lieu of glob pattern matching(this is to minimize overall code complexity).

A simple example of finding specific ${pth`.config`} files in your codebase:

${Code('Looking for all .config files with the prefix defined by svc', 'doc/find.ts')}

${Section('Resource Management')}

Resource management, loading of files, and other assets at runtime is a common pattern that the ${ResourceManagerLink} encapsulates. It provides the ability to add additional search paths, as well as resolve resources by searching in all the registerd paths.

${Code('Finding Images', 'doc/image.ts')}

${Section('Lifecycle Support')}

During the lifecycle of an application, there is a need to handle different phases of execution. When executing a phase, the code will recursively find all ${pth`phase.<phase>.ts`} files under ${pth`node_modules/@travetto`}, and in the root of your project. The format of each phase handler is comprised of five main elements:

${List(
  d`The phase of execution, which is defined by the file name ${pth`phase.<phase>.ts`} ${List(
    'The key of the handler to be referenced for dependency management.'
  )}`,
  'The list of dependent handlers that the current handler depends on, if any.',
  'The list of handlers that should be dependent on the current handler, if any.',
  'The actual functionality to execute'
)}

An example would be something like ${pth`phase.init.ts`} in the ${mod.Config} module.  

${Code('Config phase init', '@travetto/config/support/phase.init.ts')}

${Section('Shutdown Management')}

Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on shutdown. Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers. The code overrides ${meth`process.exit`} to properly handle ${inp`SIGKILL`} and ${inp`SIGINT`}, with a default threshold of 3 seconds. In the advent of a ${inp`SIGTERM`} signal, the code exits immediately without any cleanup.

As a registered shutdown handler, you can do.
${Code('Registering a shutdown handler', 'doc/shutdown.ts')}

${Section('Standard Error Support')}

While the framework is 100 % compatible with standard ${inp`Error`} instances, there are cases in which additional functionality is desired. Within the framework we use ${AppErrorLink} (or its derivatives) to represent framework errors. This class is available for use in your own projects. Some of the additional benefits of using this class is enhanced error reporting, as well as better integration with other modules (e.g. the ${mod.Rest} module and HTTP status codes).  

The ${AppErrorLink} takes in a message, and an optional payload and / or error classification. The currently supported error classifications are:
${List(
  d`${inp`general`} - General purpose errors`,
  d`${inp`system`} - Synonym for ${inp`general`}`,
  d`${inp`data`} - Data format, content, etc are incorrect. Generally correlated to bad input.`,
  d`${inp`permission`} - Operation failed due to lack of permissions`,
  d`${inp`auth`} - Operation failed due to lack of authentication`,
  d`${inp`missing`} - Resource was not found when requested`,
  d`${inp`timeout`} - Operation did not finish in a timely manner`,
  d`${inp`unavailable`} - Resource was unresponsive`,
)}


${SubSection('Stacktrace')}
The built in stack filtering will remove duplicate or unnecessary lines, as well as filter out framework specific steps that do not aid in debugging.  The final result should be a stack trace that is concise and clear.  

From a test scenario:

${Code('Tracking asynchronous behavior', 'doc/stack-test.ts')}

Will produce the following stack trace:

${Execute('Stack trace from async errors', 'doc/stack-test.ts')}

The needed functionality cannot be loaded until ${meth`init.action`} executes, and so must be required only at that time.

${Section('General Utilities')}
Simple functions for providing a minimal facsimile to ${lib.Lodash}, but without all the weight. Currently ${UtilLink} includes:

${List(
  d`${meth`isPrimitive(el)`} determines if ${inp`el`} is a ${inp`string`}, ${inp`boolean`}, ${inp`number`} or ${inp`RegExp`}`,
  d`${meth`isPlainObject(obj)`} determines if the obj is a simple object`,
  d`${meth`isFunction(o)`} determines if ${inp`o`} is a simple ${inp`Function`}`,
  d`${meth`isClass(o)`} determines if ${inp`o`} is a class constructor`,
  d`${meth`isSimple(a)`} determines if ${inp`a`} is a simple value`,
  d`${meth`deepAssign(a, b, mode ?)`} which allows for deep assignment of ${inp`b`} onto ${inp`a`}, the ${inp`mode`} determines how aggressive the assignment is, and how flexible it is.  ${inp`mode`} can have any of the following values: ${List(
    d`${inp`loose`}, which is the default is the most lenient. It will not error out, and overwrites will always happen`,
    d`${inp`coerce`}, will attempt to force values from ${inp`b`} to fit the types of ${inp`a`}, and if it can't it will error out`,
    d`${inp`strict`}, will error out if the types do not match`,
  )}`,
  d`${meth`uuid(len: number)`} generates a simple uuid for use within the application.`
)}

${Section('SystemUtil')}

Unlike ${UtilLink}, the ${SystemUtilLink} is primarily meant for internal framework support. That being said, there are places where this functionality can prove useful.  ${SystemUtilLink} has functionality for:

${List(
  d`${meth`naiveHash(text: string): number`} computes a very naive hash. Should not be relied upon for scenarios where collisions cannot be tolerated.`,
  d`${meth`computeModule(file: string): string`} computes the internal module name from a given file.`
)}

${Section('CLI - build')} 

${Execute('Build usage', 'trv', ['build', '--help'])}

This command line operation pre-compiles all of the application source code.  You can target the output location as well, which is useful in conjunction with ${fld`process.env.TRV_CACHE`} for relocating the compiled files.

${Section('CLI - clean')}

The module provides the ability to clear the compilation cache to handle any inconsistencies that may arise.

${Execute('Clean operation', 'trv', ['clean', '--help'])}
`;