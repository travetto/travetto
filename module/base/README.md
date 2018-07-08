travetto: Base
===

Base is the foundation of all `travetto` applications.  It is intended to be a minimal application bootstrap, as well as support for commonly shared functionality. The key areas that it offers

## General App Info
This is a programmatic interface to `package.json`, which provides key information on:
* Application Name
* Version
* Package
* Development Dependencies
* ...more

## Bulk File System Operations
The framework does a bit of file system scanning to auto load files, and to have knowledge of what files are available. The tools provide:
* Very simple functionality for recursively finding files, and caching the results
* Utilizes RegEx in lieu of glob for pattern matching on files (this is to minimize overall code complexity)

A simple example of finding all `.config` files in your codebase:

```typescript
  function processServiceConfigs(svc: string) {
    const svcConfigs = await findAppFiles('.config', file => path.basename(file).startsWith(`${svc}.`));
    for (const conf of svcConfigs) {
      ... do work
    }
  }
```

## Environmental Information
The framework provides basic environment information, e.g. in prod/test/dev.  This is useful for runtime decisions.  This is primarily used by the framework, but can prove useful to application developers as well. The information that is available is:
* `prod: boolean` - is the application in prod mode 
* `dev: boolean` - is the application in development mode
* `test: boolean` - is the application currently in test mode
* `watch: boolean` - is the application currently watching for file changes and reloads (normally only during development)
* `all: string[]` - a list of all the environments that are passed in and configured
* `docker: boolean` - does the environment support docker, and should it use it if needed
* `debug: boolean` - is the application currently in debug mode
* `trace: boolean` - is the application currently in trace mode
* `cwd: string` - what is the root folder of the application

## Shutdown
This is centralized functionality for running operations on shutdown.  Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers and awaiting shutdown to finish.

As a registered handler, you can do.

```typescript
Shutdown.onShutdown('handler-name', async () => {
  // Do important work
})
```

If knowing when shutdown finishes is all you want, you can simply use:

```typescript
async function messageOnShutdown() {
  await Shutdown.onShutdownPromise();
  console.log('Shutdown is complete!');
}
```

## Stacktrace 
Integration with [`trace.js`](https://trace.js.org/) to handle asynchronous call stacks, and provide higher quality stack traces.  The stack filtering will remove duplicate or unnecessary lines, as well as filter out framework specific steps that do not aid in debugging.  The final result should be a stack trace that is concise and clear.

From a test scenario:
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

```
Error: Uh oh
    at Timeout.inner3 [as _onTimeout] (./test/stack.js:6:23)
    at Timeout.inner2 [as _onTimeout] (./test/stack.js:5:13)
    at Timeout.inner1 [as _onTimeout] (./test/stack.js:4:9)
    at Object.load [as .ts] (./bin/travetto.js:27:12)
```


## Phase management
During the lifecycle of an application, there is a need to handle different phases of execution
  * Recursively finds all `phase.<phase>.ts` files under `node_modules/@travetto`, and in the root of your project
  * The format of each initializer is comprised of three main elements:
    1. The phase of execution, which is defined by the file name `phase.<phase>.ts`
    2. The priority within the phase, a number in which lower is of higher importance
    3. The actual functionality to execute

An example would be something like `phase.bootstrap.ts` in the [`Config`](https://github.com/travetto/config) module.  

```typescript
export const init = {
  priority: 1, // Lower is of more importance, and runs first
  action: () => {
    require('../src/service/config').init();
  }
}
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

## Watch
A very simple file watching library, with a substantially smaller footprint than [`gaze`](https://github.com/shama/gaze) or [`chokidar`](https://github.com/paulmillr/chokidar).  

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