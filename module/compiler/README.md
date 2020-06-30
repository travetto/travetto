# Compiler
## Node-integration of Typescript Compiler with advanced functionality for detecting changes in classes and methods.

**Install: @travetto/compiler**
```bash
npm install @travetto/compiler
```

This module expands upon [typescript](https://typescriptlang.org), with supplemental functionality:
   
   *  Read `tsconfig.json` from the project directory to provide 
   *  Supports on-the-fly compilation, nothing needs to be compiled ahead of time
   *  Enhanced AST transformations, and transformer registration [object Object]
   *  Intelligent caching of source files to minimize recompilation
   *  Support for detecting changes in sources files at runtime
   *  Allows for hot-reloading of classes during development    
      *  Utilizes `es2015` `Proxy`s to allow for swapping out implementation at runtime

Additionally, there is support for common AST transformations via [Transformation](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module//transformer "Functionality for AST transformations, with transformer registration, and general utils")

## Debugging

When dealing with transformers, logging is somewhat tricky as the compiler executes before the code is loaded.  To that end, the file `compiler.log` is created in the cache directory during the compilation process. This is a location that transformers should be free to log to, for debugging, and any additional feedback.

## CLI - compile 

**Terminal: Compiler usage**
```bash
$ travetto travetto compile --help

Usage:  compile [options]

Options:
  -c, --clean            Indicates if the cache dir should be cleaned
  -o, --output <output>  Output directory
  -q, --quiet            Quiet operation
  -h, --help             display help for command
```

This command line operation pre-compiles all of the application source code.  You can target the output location as well, which is useful in conjunction with `process.env.TRV_CACHE` for relocating the compiled files.
