travetto: Compiler
===

Basis for a more thorough compilation process, including source maps.  The compiler also provides the ability for handling
a piple of AST transformations.  The framework uses AST transformations to support it's own needs, with the reality that
external modules, or even project code might want to provide it's own transformations. In addition to the loading of transformations
the Compiler module also provides a set of utilities to enhance the transformation process.

Transformations are defined by `transformation.*.ts` as the filename. The schema for a transformation is 

```typescript
  export class CustomerTransformer {
    priority: 1, // Lower is higher priority
    phase: 'before'|'after', // The phase as defined by Typescript's AST processing
    transformer: (context: ts.TransformationContext) => {
       return (file: ts.SourceFile) => file    
    }
  }
```

