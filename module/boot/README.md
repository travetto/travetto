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

## Environmental Information
The functionality we support for testing and retrieving environment information:
* `hasProfile(p: string): boolean;` - Test whether or not a profile is active.
* `isTrue(key: string): boolean;` - Test whether or not an environment flag is set and is true
* `isFalse(key: string): boolean;` - Test whether or not an environment flag is set and is false
* `isSet(key:string): boolean;` - Test whether or not an environment value is set (excludes: `null`, `''`, and `undefined`)
* `get(key: string, def?: string): string;` - Retrieve an environmental value with a potential default
* `getInt(key: string, def?: number): number;` - Retrieve an environmental value as a number
* `getList(key: string): string[];` - Retrieve an environmental value as a list

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