travetto: Compiler
===


**Install: primary**
```bash
$ npm install @travetto/compiler
```


This module expands upon [`typescript`](http://typescriptlang.org), with supplemental functionality:
* Read `tsconfig.json` from the project directory to provide 
* Supports on-the-fly compilation, nothing needs to be compiled ahead of time
* Enhanced AST transformations, and transformer registration
  * All AST transformations are single-file based, and runs without access to the `TypeChecker`
* Intelligent caching of source files to minimize recompilation
* Support for detecting changes in sources files at runtime
* Allows for hot-reloading of classes during development
  * Utilizes `es2015` ```Proxy```s to allow for swapping out implementation at runtime

Additionally, there is support for common AST transformation patterns to facilitate all the transformers used throughout the framework.
Transformations are defined by `support/transformer.<name>.ts` as the filename. The schema for a transformer is:

**Code: Sample transformer, registration and execution**
```typescript
  export class CustomerTransformer {
    after: ['base'],
    phase: 'before'|'after', // The phase as defined by Typescript's AST processing
    transformer: (context: ts.TransformationContext) => {
       return (file: ts.SourceFile) => {
         ... modify source file ...
         return file;
       }
    }
  }
```

## Advanced
When dealing with transformers, logging is somewhat tricky as the compiler executes before the code is loaded.  To that end, a file `compiler.log` is created in the cache directory during the compilation process. This is a location that transformers should be free to log to, for debugging, and any additional feedback.
