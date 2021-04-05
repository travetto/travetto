import { d, lib } from '@travetto/doc';
import { FileCache, ExecUtil, StreamUtil } from './src';

const AppCacheLink = d.Ref('AppCache', 'src-ts/cache.ts');
const FileCacheLink = d.Ref(FileCache.name, 'src-ts/cache.ts');
const FsUtilLink = d.Ref('FsUtil', 'src-ts/fs.ts');
const ScanFsLink = d.Ref('ScanFs', 'src-ts/scan.ts');
const ExecUtilLink = d.Ref(ExecUtil.name, 'src-ts/exec.ts');
const StreamUtilLink = d.Ref(StreamUtil.name, 'src-ts/stream.ts');

export const text = d`
${d.Header()}

Boot is basic environment  awareness coupled with typescript bootstrapping for ${lib.Travetto} apps and libraries.  It has support for the following key areas:
${d.List(
  'Environmental Information',
  'Cache Support',
  'File Operations',
  'Typescript Bootstrapping',
  'Process Execution',
  'Stream Support'
)}

${d.Section('Environmental Information')}
The functionality we support for testing and retrieving environment information:
${d.List(
  d`${d.Method('isTrue(key: string): boolean;')} - Test whether or not an environment flag is set and is true`,
  d`${d.Method('isFalse(key: string): boolean;')} - Test whether or not an environment flag is set and is false`,
  d`${d.Method('isSet(key:string): boolean;')} - Test whether or not an environment value is set (excludes: ${d.Input('null')}, ${d.Input("''")}, and ${d.Input('undefined')})`,
  d`${d.Method('get(key: string, def?: string): string;')} - Retrieve an environmental value with a potential default`,
  d`${d.Method('getInt(key: string, def?: number): number;')} - Retrieve an environmental value as a number`,
  d`${d.Method('getList(key: string): string[];')} - Retrieve an environmental value as a list`,
  d`${d.Method('getTime(key: string, def: number):number')} - Reads an environment variable as milliseconds, with support for ${d.Input('s')}, ${d.Input('m')}, and ${d.Input('h')} suffixes to provide succinct time units.`
)}

${d.Section('Cache Support')}
The framework uses a file cache to support it's compilation activities for performance.  This cache is also leveraged by other modules to support storing of complex calculations.  ${AppCacheLink} is the cache that is used specific to the framework, and is an instance of ${FileCacheLink}.  ${FileCacheLink} is the generic structure for supporting a file cache that invalidates on modification/creation changes.

The class organization looks like:

${d.Code('File Cache Structure', 'src/cache.d.ts')}

Everything is based on absolute paths being passed in, and translated into cache specific files.

${d.Section('File Operations')}
${FsUtilLink} provides some high level functionality (like recursive directory delete).

${d.SubSection('File System Scanning')}
${ScanFsLink} provides a breadth-first search through the file system with the ability to track and collect files via patterns.

${d.Section('Typescript Bootstrapping')}

${d.SubSection('Source Indexing')}
The bootstrap process will also requires an index of all source files, which allows for fast in-memory scanning.  This allows for all the automatica discovery that is used within the framework (and transpiling).

${d.SubSection('Registration')}
This functionality allows the program to opt in the typescript compiler.  This allows for run-time compilation of typescript files.

${d.Section('Process Execution')}
Just like ${lib.ChildProcess}, the ${ExecUtilLink} exposes ${d.Method('spawn')} and ${d.Method('fork')}.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a ${d.Input('Promise')} structure, that throws an error on an non-zero return status.

A simple example would be:

${d.Code('Running a directory listing via ls', 'doc/exec.ts')}

As you can see, the call returns not only the child process information, but the ${d.Input('Promise')} to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module also supports:

${d.List(
  d`${d.Input('timeout')} as the number of milliseconds the process can run before terminating and throwing an error`,
  d`${d.Input('quiet')} which suppresses all stdout/stderr output`,
  d`${d.Input('stdin')} as a string, buffer or stream to provide input to the program you are running;`,
  d`${d.Input('timeoutKill')} allows for registering functionality to execute when a process is force killed by timeout`
)}

${d.Section('Stream Support')}
The ${StreamUtilLink} class provides basic stream utilities for use within the framework:

${d.List(
  d`${d.Method('toBuffer(src: Readable | Buffer | string): Promise<Buffer>')} for converting a stream/buffer/filepath to a Buffer.`,
  d`${d.Method('toReadable(src: Readable | Buffer | string):Promise<Readable>')} for converting a stream/buffer/filepath to a Readable`,
  d`${d.Method('writeToFile(src: Readable, out: string):Promise<void>')} will stream a readable into a file path, and wait for completion.`,
  d`${d.Method('waitForCompletion(src: Readable, finish:()=>Promise<any>)')} will ensure the stream remains open until the promise finish produces is satisfied.`,
)}
`;