travetto: Base
===

Base is the foundation of all travetto applications.  It's primary goal is to be a minimal bootstrap to get an application up and running.

The specific things it offers are:
* General App Info - A programmatic interface to `package.json`
* Bulk Find Operations
  * A very simple toolset for recursively finding files
  * Uses RegEx in lieu of glob for pattern matching on files
* Environment - Basic environment information, e.g. in prod/test/dev etc.
* Shutdown - Event listener interface to run code on shutdown
* Stacktrace - Integration with `trace.js` to provide proper asynchronous stack traces
* Startup - Bootstrapping code for initializing applications
  * Recursively finds all `bootstrap.ts` files under `node_modules/@travetto`, and in the root of your project
  * The export format of each initializer is ```
   export const init = {
    priority: 1, // Lower is of more importance
    action: () => {} // The action to take to initialize the module/project
  }```
* Util - Simple functions for providing a minimal facisimile to `lodash`, but without all the weight.
* Watch - A very simple file watching library, with a substantially smaller footprint than `gaze` or `chokidar`.  