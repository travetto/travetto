<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/compiler/doc.ts and execute "npx trv doc" to rebuild -->
# Compiler
## Node-integration of Typescript Compiler with advanced functionality for detecting changes in classes and methods.

**Install: @travetto/compiler**
```bash
npm install @travetto/compiler
```

This module expands upon [Typescript](https://typescriptlang.org), with supplemental functionality:
   
   *  Read `tsconfig.json` from the project directory to provide 
   *  Supports on-the-fly compilation, nothing needs to be compiled ahead of time
   *  Enhanced AST transformations, and transformer registration [object Object]
   *  Intelligent caching of source files to minimize recompilation
   *  Support for detecting changes in sources files at runtime
   *  Allows for hot-reloading of classes during development    
      *  Utilizes `es2015` `Proxy`s to allow for swapping out implementation at runtime

Additionally, there is support for common AST transformations via [Transformation](https://github.com/travetto/travetto/tree/main/module/transformer#readme "Functionality for AST transformations, with transformer registration, and general utils")

## Debugging

When dealing with transformers, logging is somewhat tricky as the compiler executes before the code is loaded.  To that end, the file `compiler.log` is created in the cache directory during the compilation process. This is a location that transformers should be free to log to, for debugging, and any additional feedback.
