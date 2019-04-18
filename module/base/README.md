travetto: Base
===

**Install: primary**
```bash
$ npm install @travetto/base
```

Base is the foundation of all `travetto` applications.  It is intended to be a minimal application bootstrap, as well as support for commonly shared functionality. It has support for the following key areas:
* Environmental Information
* File Operations
* Resource Management
* Life-cycle Support
* Stacktrace Management 
* General Utilities

## Environmental Information
The framework provides basic environment information, e.g. in prod/test/dev.  This is useful for runtime decisions.  This is primarily used by the framework, but can prove useful to application developers as well. The information that is available is:
* `prod`/`dev` - Run type flags.  These are mutually exclusive and are `boolean` flags.
* `watch: boolean` - Does the current run support file watching.  Primarily used internally, but should be useful to indicate if the program will finish immediately or wait indefinitely.
* `profiles: string[]` - Specific application profiles that have been activated.  This is useful for indicating different configuration or run states.
* `debug`/`trace` - Simple logging flags.  These `boolean` flags will enable or disable logging at various levels. By default `debug` is on in `dev` or `e2e` mode, and nowhere else.  `trace` is always off by default.
* `cwd: string` - The root of the current project, 
* `appRoots: string[]` - The file root paths for the application, the default set is the current project. Order matters with respect to resource resolution. All paths should be relative to the project base

With respect to `process.env`, we specifically test for all uppercase, lowercase, and given case.  This allows us to test various patterns and catch flags that might be off due to casing.  That would mean that a key of `Enable_Feature` would be tested as:
* `Enable_Feature`
* `ENABLE_FEATURE`
* `enable_feature`

### App Information
This basically exposes your `package.json` data as a typed data structure, useful for integrating package information into your application.

## File Operations
The framework does a fair amount of file system scanning to auto-load files.  It also needs to have knowledge of what files are available. The framework provides a simple and performant functionality for recursively finding files. This functionality leverages regular expressions in lieu of glob pattern matching (this is to minimize overall code complexity).

A simple example of finding specific `.config` files in your codebase:

**Code: Looking for all .config files with the prefix defined by svc**
```typescript
  function processServiceConfigs(svc: string) {
    const svcConfigs = await ScanApp.findFiles('.config', file => path.basename(file).startsWith(`${svc}.`));
    for (const conf of svcConfigs) {
      ... do work
    }
  }
```

The framework utilizes caching to enable these lookups to be repeated without performance impact.  In addition to file system scanning, the framework offers a simple file watching library.  The goal is to provide a substantially smaller footprint than [`gaze`](https://github.com/shama/gaze) or [`chokidar`](https://github.com/paulmillr/chokidar).  Utilizing the patterns from the file scanning, you create a `Watcher` that either has files added manually, or has patterns added that will recursively look for files. 

**Code: Example of watching for specific files**
```typescript
const watcher = new Watcher({cwd: 'base/path/to/...'});
watcher.add([
  'local.config',
  {
    testFile: x => x.endsWith('.config') || x.endsWith('.config.json')
  }
]);
watcher.run();
```

## Application Resources

Resource management, loading of files, and other assets at runtime is a common pattern that the `ResourceManager` encapsulates.  It provides the ability to add additional search paths, as well as resolve resources by searching in all the registerd paths.

**Code: Finding Image Resource**
```typescript
const imagePath = await ResourceManager.findFirst('/images/asset.gif');
```

**Code: Finding All Image Resource**
```typescript
const imagePaths = await ResourceManager.findAllByExtension('gif', 'images/');
```

## Lifecycle Support

During the lifecycle of an application, there is a need to handle different phases of execution.  When executing a phase, the code will recursively find all `phase.<phase>.ts` files under `node_modules/@travetto`, and in the root of your project.  The format of each phase handler is comprised of five main elements:
* The phase of execution, which is defined by the file name `phase.<phase>.ts`
* The key of the handler to be referenced for dependency management.
* The list of dependent handlers that the current handler depends on, if any.
* The list of handlers that should be dependent on the current handler, if any.
* The actual functionality to execute

An example would be something like `phase.bootstrap.ts` in the [`Config`](https://github.com/travetto/travetto/tree/master/module/config) module.  

**Code: Sample phase bootstrap**
```typescript
export const init = {
  key: 'config',
  after: 'base',
  action: () => {
    require('../src/service/config').init();
  }
}
```

## Common Application Error Class
While the framework is 100% compatible with standard `Error` instances, there are cases in which additional functionality is desired.  Within the framework we use `AppError` (or its derivatives) to represent framework errors.  This class is available for use in your own projects.  Some of the additional benefits of using this class is enhanced error reporting, as well as better integration with other modules (e.g. the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module and HTTP status codes).  

The `AppError` takes in a message, and an optional payload and/or error classification.  The currently supported error classifications are:
* `general` - General purpose errors
* `system`  - Synonym for `general`
* `data` - Data format, content, etc are incorrect.  Generally correlated to bad input.
* `permission` - Operation failed due to lack of permissions
* `auth` - Operation failed due to lack of authentication
* `missing` - Resource was not found when requested
* `timeout` - Operation did not finish in a timely manner
* `unavailable` - Resource was unresponsive

## Shutdown
Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on shutdown.  Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers.  The code overrides `process.exit` to properly handle `SIGKILL` and `SIGINT`, with a default threshold of 3 seconds.  In the advent of a `SIGTERM` signal, the code exits immediately without any cleanup.

As a registered shutdown handler, you can do.

**Code: Registering a shutdown handler**
```typescript
Shutdown.onShutdown('handler-name', async () => {
  // Do important work, the framework will wait until all async 
  //   operations are completed before finishing shutdown
})
```

## Stacktrace 
We integrate with [`trace.js`](https://trace.js.org/) to handle asynchronous call stacks, and provide higher quality stack traces.  The stack filtering will remove duplicate or unnecessary lines, as well as filter out framework specific steps that do not aid in debugging.  The final result should be a stack trace that is concise and clear.  This is primarily used for development purposes, and is disabled by default in `prod`.  That means in a production environment you will get the full stacktrace, in all it's glory.

From a test scenario:

**Code: Tracking asynchronous behavior**
```typescript
function test() {
  setTimeout(function inner1() {
    setTimeout(function inner2() {
      setTimeout(function inner3() {
        throw new Error('Uh oh');
      }, 1);
    }, 1);
  }, 1);
}

test();
```

Will produce the following stack trace:

**Terminal: Stack trace from async errors**
```bash
Error: Uh oh
    at Timeout.inner3 [as _onTimeout] (./test/stack.js:6:23)
    at Timeout.inner2 [as _onTimeout] (./test/stack.js:5:13)
    at Timeout.inner1 [as _onTimeout] (./test/stack.js:4:9)
    at Object.load [as .ts] (./bin/travetto.js:27:12)
```

The needed functionality cannot be loaded until `init.action` executes, and so must be required only at that time.

## Util 
Simple functions for providing a minimal facsimile to [`lodash`](https://lodash.com), but without all the weight. Currently `util` only includes:

* `isPrimitive(el: any)` determines if `el` is a `string`, `boolean`, `number` or `RegExp`
* `isPlainObject(obj: any)` determines if the obj is a simple object
* `isFunction(o: any)` determines if `o` is a simple `Function`
* `isClass(o: any)` determines if `o` is a class constructor
* `isSimple(a: any)` determines if `a` is a simple value
* `deepAssign(a: any, b: any, mode?)` which allows for deep assignment of `b` onto `a`, the `mode` determines how aggressive the assignment is, and how flexible it is.  `mode` can have any of the following values:
  * `loose`, which is the default is the most lenient.  It will not error out, and overwrites will always happen
  * `coerce`, will attempt to force values from `b` to fit the types of `a`, and if it can't it will error out
  * `strict`, will error out if the types do not match  
* `throttle(fn, threshhold?: number)` produces a function that will execute `fn`, at most once per `threshold`
