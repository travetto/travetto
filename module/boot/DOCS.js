const { doc: d, Code, Section, List, inp, meth, Ref, lib, Execute } = require('@travetto/doc');
const { FileCache, ExecUtil, StreamUtil } = require('./src');

const AppCacheLink = Ref('AppCache', './src-ts/app-cache.ts');
const FileCacheLink = Ref(FileCache.name, './src-ts/cache.ts');
const FsUtilLink = Ref('FsUtil', './src-ts/fs.ts');
const ScanFsLink = Ref('ScanFs', './src-ts/scan.ts');
const ExecUtilLink = Ref(ExecUtil.name, './src-ts/exec.ts');
const StreamUtilLink = Ref(StreamUtil.name, './src-ts/stream.ts');

exports.text = d`
Boot is basic environment  awareness coupled with typescript bootstrapping for ${lib.Travetto} apps and libraries.  It has support for the following key areas:
${List(
  'Environmental Information',
  'Cache Support',
  'File Operations',
  'Typescript bootstrapping',
  'Process execution',
  'Stream Support'
)}

${Section('Environmental Information')}
The functionality we support for testing and retrieving environment information:
${List(
  d`${meth`isTrue(key: string): boolean;`} - Test whether or not an environment flag is set and is true`,
  d`${meth`isFalse(key: string): boolean;`} - Test whether or not an environment flag is set and is false`,
  d`${meth`isSet(key:string): boolean;`} - Test whether or not an environment value is set (excludes: ${inp`null`}, ${inp`''`}, and ${inp`undefined`})`,
  d`${meth`get(key: string, def?: string): string;`} - Retrieve an environmental value with a potential default`,
  d`${meth`getInt(key: string, def?: number): number;`} - Retrieve an environmental value as a number`,
  d`${meth`getList(key: string): string[];`} - Retrieve an environmental value as a list`,
  d`${meth`getTime(key: string, def: number):number`} - Reads an environment variable as milliseconds, with support for ${inp`s`}, ${inp`m`}, and ${inp`h`} suffixes to provide succinct time units.`
)}

${Section('File Cache')}
The framework uses a file cache to support it's compilation activities for performance.  This cache is also leveraged by other modules to support storing of complex calculations.  ${AppCacheLink} is the cache that is used specific to the framework, and is an instance of ${FileCacheLink}.  ${FileCacheLink} is the generic structure for supporting a file cache that invalidates on modification/creation changes.

The class organization looks like:

${Code('File Cache Structure', './src/cache.d.ts')}

Everything is based on absolute paths being passed in, and translated into cache specific files.

${Section('Registration')}
This functionality allows the program to opt in the typescript compiler.  This allows for run-time compilation of typescript files.

${Section('File System Interaction')}
${FsUtilLink} provides some high level functionality (like recursive directory delete).


${Section('File System Scanning')}
${ScanFsLink} provides a breadth-first search through the file system with the ability to track and collect files via patterns.

${Section('Process Execution')}
Just like ${lib.ChildProcess}, the ${ExecUtilLink} exposes ${meth`spawn`} and ${meth`fork`}.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a ${inp`Promise`} structure, that throws an error on an non-zero return status.

A simple example would be:

${Code('Running a directory listing via ls', 'alt/docs/src/exec.ts')}

As you can see, the call returns not only the child process information, but the ${inp`Promise`} to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module also supports:

${List(
  d`${inp`timeout`} as the number of milliseconds the process can run before terminating and throwing an error`,
  d`${inp`quiet`} which suppresses all stdout/stderr output`,
  d`${inp`stdin`} as a string, buffer or stream to provide input to the program you are running;`,
  d`${inp`timeoutKill`} allows for registering functionality to execute when a process is force killed by timeout`
)}

${Section('Stream Support')}
The ${StreamUtilLink} class provides basic stream utilities for use within the framework:

${List(
  d`${meth`toBuffer(src: Readable | Buffer | string): Promise<Buffer>`} for converting a stream/buffer/filepath to a Buffer.`,
  d`${meth`toReadable(src: Readable | Buffer | string):Promise<Readable>`} for converting a stream/buffer/filepath to a Readable`,
  d`${meth`writeToFile(src: Readable, out: string):Promise<void>`} will stream a readable into a file path, and wait for completion.`,
  d`${meth`waitForCompletion(src: Readable, finish:()=>Promise<any>)`} will ensure the stream remains open until the promise finish produces is satisfied.`,
)}

${Section('CLI - clean')}

The module provides the ability to clear the compilation cache to handle any inconsistencies that may arise.

${Execute('Clean operation', 'travetto', ['clean', '--help'])}
`;