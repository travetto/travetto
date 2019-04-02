travetto: Boot
===

**Install: primary**
```bash
$ npm install @travetto/boot
```

Boot is basic environment  awareness coupled with typescript bootstrapping for `travetto` apps and libraries.  It has support for the following key areas:
* Environmental Information
* Application Information
* Cache Support
* File Operations
* Typescript bootstrapping

## Environmental Information
The framework provides basic environment information, e.g. in prod/test/dev.  This is useful for runtime decisions.  This is primarily used by the framework, but can prove useful to application developers as well. The information that is available is:
* `prod`/`dev` - Run type flags.  These are mutually exclusive and are `boolean` flags.
* `watch: boolean` - Does the current run support file watching.  Primarily used internally, but should be useful to indicate if the program will finish immediately or wait indefinitely.
* `profiles: string[]` - Specific application profiles that have been activated.  This is useful for indicating different configuration or run states.
* `debug`/`trace` - Simple logging flags.  These `boolean` flags will enable or disable logging at various levels. By default `debug` is on in `dev` or `e2e` mode, and nowhere else.  `trace` is always off by default.
* `cwd: string` - The root of the current project, 
* `appRoots: string[]` - The file root paths for the application, the default set is the current project. Order matters with respect to resource resolution. All paths should be relative to the project base
* `docker` - Determine if docker support is enabled. If explicitly set, honor, otherwise it will attempt to invoke the `docker` cli and use that as it's indicator. 

With respect to `process.env`, we specifically test for all uppercase, lowercase, and given case.  This allows us to test various patterns and catch flags that might be off due to casing.  That would mean that a key of `Enable_Feature` would be tested as:
* `Enable_Feature`
* `ENABLE_FEATURE`
* `enable_feature`

This pattern is used throughout the following functionality for testing and retrieving environmental values.

 The functionality we support for testing and retrieving is:
* `hasProfile(p: string): boolean;` - Test whether or not a profile is active.
* `isTrue(key: string): boolean;` - Test whether or not an environment flag is set and is true
* `isFalse(key: string): boolean;` - Test whether or not an environment flag is set and is false
* `get(key: string, def?: string): string;` - Retrieve an environmental value with a potential default
* `getInt(key: string, def?: number): number;` - Retrieve an environmental value as a number
* `getList(key: string): string[];` - Retrieve an environmental value as a list

## File Cache
The framework uses a file cache to support it's compilation activities for performance.  This cache is also leveraged by other modules to support storing of complex calculations.  `AppCache` is the cache that is used specific to the framework, and is an instance of `FileCache`.  `FileCache` is the generic structure for supporting a file cache that invalidates on modification/creation changse.

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

## App Information
This basically exposes your `package.json` data as a typed data structure, useful for integrating package information into your application.

## Registration
This functionality allows the program to opt in the typescript compiler.  This allows for run-time compilation of typescript files.

## File System Interaction
The two pieces of functionality used for file system interaction are `FsUtil` and `ScanFs`.  `FsUtil` provides some high level functionality (like recursive directory delete).  `ScanFs` is meant for searching (and caching) traversals through the file system, looking for patterns via regex or function handlers.