travetto: Boot
===

**Install: primary**
```bash
$ npm install @travetto/env
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

