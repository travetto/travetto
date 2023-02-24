import { d, mod, lib } from '@travetto/doc';
import { ExecUtil, AppError, StreamUtil, ObjectUtil, DataUtil, Util } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

const ConsoleManager = d.Ref('ConsoleManager', 'src/console.ts');

export const text = () => d`
${d.Header()}

Base is the foundation of all ${lib.Travetto} applications.  It is intended to be a minimal application set, as well as support for commonly shared functionality. It has support for the following key areas:

${d.List(
  'Environment Support',
  'Shared Global Environment State',
  'Console Management',
  'Standard Error Support',
  'Stream Utilities',
  'Object Utilities',
  'Data Utilities',
  'Common Utilities',
  'Time Utilities',
  'Process Execution',
  'Shutdown Management'
)}

${d.Section('Environment Support')}
The functionality we support for testing and retrieving environment information:
${d.List(
  d`${d.Method('isTrue(key: string): boolean;')} - Test whether or not an environment flag is set and is true`,
  d`${d.Method('isFalse(key: string): boolean;')} - Test whether or not an environment flag is set and is false`,
  d`${d.Method('isSet(key:string): boolean;')} - Test whether or not an environment value is set (excludes: ${d.Input('null')}, ${d.Input("''")}, and ${d.Input('undefined')})`,
  d`${d.Method('get(key: string, def?: string): string;')} - Retrieve an environmental value with a potential default`,
  d`${d.Method('getBoolean(key: string, isValue?: boolean)')} - Retrieve an environmental value as a boolean.  If isValue is provided, determine if the environment variable matches the specified value`,
  d`${d.Method('getInt(key: string, def?: number): number;')} - Retrieve an environmental value as a number`,
  d`${d.Method('getList(key: string): string[];')} - Retrieve an environmental value as a list`,
)}

${d.Section('Shared Global Environment State')}


${d.Section('Standard Error Support')}

While the framework is 100 % compatible with standard ${d.Input('Error')} instances, there are cases in which additional functionality is desired. Within the framework we use ${AppError} (or its derivatives) to represent framework errors. This class is available for use in your own projects. Some of the additional benefits of using this class is enhanced error reporting, as well as better integration with other modules (e.g. the ${mod.Rest} module and HTTP status codes).  

The ${AppError} takes in a message, and an optional payload and / or error classification. The currently supported error classifications are:
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

${d.Code('Sample After Transpilation', RootIndex.resolveFileImport('@travetto/base/doc/transpile.ts'), false, 'javascript')}


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

${d.Section('Stream Utilities')}
The ${StreamUtil} class provides basic stream utilities for use within the framework:

${d.List(
  d`${d.Method('toBuffer(src: Readable | Buffer | string): Promise<Buffer>')} for converting a stream/buffer/filepath to a Buffer.`,
  d`${d.Method('toReadable(src: Readable | Buffer | string):Promise<Readable>')} for converting a stream/buffer/filepath to a Readable`,
  d`${d.Method('writeToFile(src: Readable, out: string):Promise<void>')} will stream a readable into a file path, and wait for completion.`,
  d`${d.Method('waitForCompletion(src: Readable, finish:()=>Promise<any>)')} will ensure the stream remains open until the promise finish produces is satisfied.`,
  d`${d.Method('streamLines(file: string, ensureEmpty = false): AsyncIterable<string>')} will watch a file for any line changes, and produce those changes as asynchronous iterable stream. Functionally, this is equivalent to using the Unix tail operation on a file`,
)}

${d.Section('Object Utilities')}
Simple functions for providing a minimal facsimile to ${lib.Lodash}, but without all the weight. Currently ${ObjectUtil} includes:

${d.List(
  d`${d.Method('isPrimitive(el)')} determines if ${d.Input('el')} is a ${d.Input('string')}, ${d.Input('boolean')}, ${d.Input('number')} or ${d.Input('RegExp')}`,
  d`${d.Method('isPlainObject(obj)')} determines if the obj is a simple object`,
  d`${d.Method('isFunction(o)')} determines if ${d.Input('o')} is a simple ${d.Input('Function')}`,
  d`${d.Method('isClass(o)')} determines if ${d.Input('o')} is a class constructor`,
  d`${d.Method('isSimple(a)')} determines if ${d.Input('a')} is a simple value`,
  d`${d.Method('isPromise(a)')} determines if ${d.Input('a')} is a promise`,
)}

${d.Section('Data Utilities')}
Data utilities for binding values, and type conversion. Currently ${DataUtil} includes:

${d.List(
  d`${d.Method('deepAssign(a, b, mode ?)')} which allows for deep assignment of ${d.Input('b')} onto ${d.Input('a')}, the ${d.Input('mode')} determines how aggressive the assignment is, and how flexible it is.  ${d.Input('mode')} can have any of the following values: ${d.List(
    d`${d.Input('loose')}, which is the default is the most lenient. It will not error out, and overwrites will always happen`,
    d`${d.Input('coerce')}, will attempt to force values from ${d.Input('b')} to fit the types of ${d.Input('a')}, and if it can't it will error out`,
    d`${d.Input('strict')}, will error out if the types do not match`,
  )}`,
  d`${d.Method('coerceType(input: unknown, type: Class<unknown>, strict = true)')} which allows for converting an input type into a specified ${d.Input('type')} instance, or throw an error if the types are incompatible.`,
  d`${d.Method('shallowClone<T = unknown>(a: T): T')} will shallowly clone a field`,
  d`${d.Method('filterByKeys<T>(obj: T, exclude: (string | RegExp)[]): T')} will filter a given object, and return a plain object (if applicable) with fields excluded using the values in the ${d.Input('exclude')} input`,
)}

${d.Section('Common Utilities')}
Common utilities used throughout the framework. Currently ${Util} includes:

${d.List(
  d`${d.Method('uuid(len: number)')} generates a simple uuid for use within the application.`,
  d`${d.Method('allowDenyMatcher(rules[])')} builds a matching function that leverages the rules as an allow/deny list, where order of the rules matters.  Negative rules are prefixed by '!'.`
)}

${d.Section('Process Execution')}
Just like ${lib.ChildProcess}, the ${ExecUtil} exposes ${d.Method('spawn')} and ${d.Method('fork')}.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a ${d.Input('Promise')} structure, that throws an error on an non-zero return status.

A simple example would be:

${d.Code('Running a directory listing via ls', 'doc/exec.ts')}

As you can see, the call returns not only the child process information, but the ${d.Input('Promise')} to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module also supports:

${d.List(
  d`${d.Input('timeout')} as the number of milliseconds the process can run before terminating and throwing an error`,
  d`${d.Input('quiet')} which suppresses all stdout/stderr output`,
  d`${d.Input('stdin')} as a string, buffer or stream to provide input to the program you are running;`,
  d`${d.Input('timeoutKill')} allows for registering functionality to execute when a process is force killed by timeout`
)}

${d.Section('Shutdown Management')}

Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on shutdown. Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers. The code overrides ${d.Method('process.exit')} to properly handle ${d.Input('SIGKILL')} and ${d.Input('SIGINT')}, with a default threshold of 3 seconds. In the advent of a ${d.Input('SIGTERM')} signal, the code exits immediately without any cleanup.

As a registered shutdown handler, you can do.
${d.Code('Registering a shutdown handler', 'doc/shutdown.ts')}
`;