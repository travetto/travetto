import { d, mod, lib } from '@travetto/doc';

import { AppError } from './src/error';
import { StreamUtil } from './src/stream';
import { Util } from './src/util';
import { ExecUtil } from './src/exec';

const UtilLink = d.Ref(Util.name, 'src/util.ts');
const ScanFsLink = d.Ref('ScanFs', 'src/scan.ts');
const AppErrorLink = d.Ref(AppError.name, 'src/error.ts');
const ResourceManagerLink = d.Ref('ResourceManager', 'src/resource.ts');
const StreamUtilLink = d.Ref(StreamUtil.name, 'src/stream.ts');
const ExecUtilLink = d.Ref(ExecUtil.name, 'src/exec.ts');

export const text = d`
${d.Header()}

Base is the foundation of all ${lib.Travetto} applications.  It is intended to be a minimal application set, as well as support for commonly shared functionality. It has support for the following key areas:

${d.List(
  'Environment Support',
  'Application Manifest',
  'File Operations',
  'File System Scanning',
  'Resource Management',
  'Process Execution',
  'Shutdown Management',
  'Standard Error Support',
  'Stream Support',
  'General Utilities'
)}

${d.Section('Environment Support')}
The functionality we support for testing and retrieving environment information:
${d.List(
  d`${d.Method('isTrue(key: string): boolean;')} - Test whether or not an environment flag is set and is true`,
  d`${d.Method('isFalse(key: string): boolean;')} - Test whether or not an environment flag is set and is false`,
  d`${d.Method('isSet(key:string): boolean;')} - Test whether or not an environment value is set (excludes: ${d.Input('null')}, ${d.Input("''")}, and ${d.Input('undefined')})`,
  d`${d.Method('get(key: string, def?: string): string;')} - Retrieve an environmental value with a potential default`,
  d`${d.Method('getInt(key: string, def?: number): number;')} - Retrieve an environmental value as a number`,
  d`${d.Method('getList(key: string): string[];')} - Retrieve an environmental value as a list`,
)}


${d.Section('Application Manifest')}
The framework provides basic environment information, e.g. in prod/test/dev.  This is useful for runtime decisions.  This is primarily used by the framework, but can prove useful to application developers 
as well. The information that is available is:

${d.List(
  d`${d.Field('env.prod')}- Determines if app is in prod mode.  A ${d.Input('boolean')} flag that should indicate a production run.`,
  d`${d.Field('env.name')} - The environment name.  Will usually be one of ${d.Input('dev')}, ${d.Input('test')}, or ${d.Input('prod')}.  Can be anything that is passed in.`,
  d`${d.Field('env.profiles: Set<string>')} - Specific application profiles that have been activated.  This is useful for indicating different configuration or run states.`,
  d`${d.Field('env.debug')} - Simple logging flag.  This ${d.Input('boolean')} flag will enable or disable logging at various levels. By default ${d.Input('debug')} is on in non-${d.Input('prod')}.`,
  d`${d.Field('env.resources: string[]')} - Resource folders.  Search paths for resolving resource requests via ${ResourceManagerLink}`,
  d`${d.Field('source.local: string[]')} - Local source folders for transpiling.  Does not extend to installed modules.`,
  d`${d.Field('source.common: string[]')} - Common source folders for transpiling. Includes installed modules.`,
  d`${d.Method('hasProfile(p: string): boolean;')} - Test whether or not a profile is active.`,
)}

${d.Section('File Operations')}
The framework does a fair amount of file system scanning to auto - load files. It also needs to have knowledge of what files are available. The framework provides a simple and performant functionality for recursively finding files. This functionality leverages regular expressions in lieu of glob pattern matching(this is to minimize overall code complexity).

A simple example of finding specific ${d.Path('.config')} files in your codebase:

${d.Code('Looking for all .config files with the prefix defined by svc', 'doc/find.ts')}

${d.SubSection('File System Scanning')}
${ScanFsLink} provides a breadth-first search through the file system with the ability to track and collect files via patterns.

${d.Section('Resource Management')}

Resource management, loading of files, and other assets at runtime is a common pattern that the ${ResourceManagerLink} encapsulates. It provides the ability to add additional search paths, as well as resolve resources by searching in all the registered paths.

${d.Code('Finding Images', 'doc/image.ts')}

${d.Section('Process Execution')}
Just like ${lib.ChildProcess}, the ${ExecUtilLink} exposes ${d.Method('spawn')} and ${d.Method('fork')}.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a ${d.Input('Promise')} structure, that throws an error on an non-zero return status.

A simple example would be:

${d.Code('Running a directory listing via ls', 'doc/exec.ts')}

As you can see, the call returns not only the child process information, but the ${d.Input('Promise')} to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module also supports:

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


${d.Section('Stream Support')}
The ${StreamUtilLink} class provides basic stream utilities for use within the framework:

${d.List(
  d`${d.Method('toBuffer(src: Readable | Buffer | string): Promise<Buffer>')} for converting a stream/buffer/filepath to a Buffer.`,
  d`${d.Method('toReadable(src: Readable | Buffer | string):Promise<Readable>')} for converting a stream/buffer/filepath to a Readable`,
  d`${d.Method('writeToFile(src: Readable, out: string):Promise<void>')} will stream a readable into a file path, and wait for completion.`,
  d`${d.Method('waitForCompletion(src: Readable, finish:()=>Promise<any>)')} will ensure the stream remains open until the promise finish produces is satisfied.`,
)}

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
  d`${d.Method('uuid(len: number)')} generates a simple uuid for use within the application.`,
  d`${d.Method('allowDenyMatcher(rules[])')} builds a matching function that leverages the rules as an allow/deny list, where order of the rules matters.  Negative rules are prefixed by '!'.`
)}

${d.Section('CLI - build')} 

${d.Execute('Build usage', 'trv', ['build', '--help'])}

This command line operation pre-compiles all of the application source code.  You can target the output location as well, which is useful in conjunction with ${d.Field('process.env.TRV_CACHE')} for relocating the compiled files.

${d.Section('CLI - clean')}

The module provides the ability to clear the compilation cache to handle any inconsistencies that may arise.

${d.Execute('Clean operation', 'trv', ['clean', '--help'])}
`;