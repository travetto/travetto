travetto: Boot
===

**Install: primary**
```bash
$ npm install @travetto/boot
```

Boot is basic environment  awareness coupled with typescript bootstrapping for `travetto` apps and libraries.  It has support for the following key areas:
* Environmental Information
* Cache Support
* File Operations
* Typescript bootstrapping
* Process execution 
* Stream Support

## Environmental Information
The functionality we support for testing and retrieving environment information:
* `isTrue(key: string): boolean;` - Test whether or not an environment flag is set and is true
* `isFalse(key: string): boolean;` - Test whether or not an environment flag is set and is false
* `isSet(key:string): boolean;` - Test whether or not an environment value is set (excludes: `null`, `''`, and `undefined`)
* `get(key: string, def?: string): string;` - Retrieve an environmental value with a potential default
* `getInt(key: string, def?: number): number;` - Retrieve an environmental value as a number
* `getList(key: string): string[];` - Retrieve an environmental value as a list
* `getTime(key: string, def: number):number` - Reads an environment variable as milliseconds, with support for `s`, `m`, and `h` suffixes to provide succinct time units.

## File Cache
The framework uses a file cache to support it's compilation activities for performance.  This cache is also leveraged by other modules to support storing of complex calculations.  `AppCache` is the cache that is used specific to the framework, and is an instance of `FileCache`.  `FileCache` is the generic structure for supporting a file cache that invalidates on modification/creation changes.

The class organization looks like:
```typescript
class FileCache {    
  constructor(cwd: string, cacheDir?: string);
  init(): void;
  writeEntry(full: string, contents: string | Buffer): void;
  readEntry(full: string): string;
  removeExpiredEntry(full: string, force?: boolean): void;
  removeEntry(full: string): void;
  hasEntry(full: string): boolean;
  statEntry(full: string): fs.Stats;
  clear(): void;
}
```
Everything is based on absolute paths being passed in, and translated into cache specific files.  

## Registration
This functionality allows the program to opt in the typescript compiler.  This allows for run-time compilation of typescript files.

## File System Interaction
`FsUtil` provides some high level functionality (like recursive directory delete). 

## File System Scanning
`ScanFs` provides a breadth-first search through the file system with the ability to track and collect files via patterns.

## Process Execution
Just like [`child_process`], the `ExecUtil` exposes ```spawn``` and ```fork```.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a ```Promise``` structure, that throws an error on an non-zero return status.

A simple example would be

**Code: Running a directory listing via ls**
```typescript
async function executeListing() {
  const { result } = ExecUtil.spawn('ls');
  await result;
}
```

As you can see, the call returns not only the child process information, but the ```Promise``` to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module also supports:
* `timeout` as the number of milliseconds the process can run before terminating and throwing an error
* `quiet` which suppresses all stdout/stderr output
* `stdin` as a string, buffer or stream to provide input to the program you are running;
* `timeoutKill` allows for registering functionality to execute when a process is force killed by timeout

## Stream Support
The `StreamUtil` class provides basic stream utilities for use within the framework:
* `toBuffer(src: Readable | Buffer | string): Promise<Buffer>` for converting a stream/buffer/filepath to a Buffer.
* `toReadable(src: Readable | Buffer | string):Promise<Readable>` for converting a stream/buffer/filepath to a Readable 
* `writeToFile(src: Readable, out: string):Promise<void>` will stream a readable into a file path, and wait for completion.
* `waitForCompletion(src: Readable, finish:()=>Promise<any>)` will ensure the stream remains open until the promise finish produces is satisfied.