travetto: Transform
===

**Install: primary**
```bash
$ npm install @travetto/transformer
```

This module provides support for enhanced AST transformations, and transformer registration, with support for common AST transformation patterns to facilitate all the transformers used throughout the framework.
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
