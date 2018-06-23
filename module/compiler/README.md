travetto: Compiler
===

The framework, while using [`typescript`](http://typescriptlang.org), has need of some extended functionality. The additional functionality is
* Supports on-the-fly compilation, nothing needs to be compiled ahead of time
* Enhanced AST transformations, and transformer registration
  * All AST transformations are single-file based, and runs without access to the `TypeChecker`
* Intelligent caching of source files to minimize recompilation
* Support for watching sources files:
  * Detecting changes to files
  * Detecting changes to specific classes
  * Detecting changes to specific methods within classes
* Allows for hot-reloading of classes during development
  * Utilizes `es2015` `Proxy`s to allow for swapping out implementation at runtime

Additionally, there is support for common AST transformation patterns to facilitate all the transformers used throughout the framework. Functionality includes:
  * `getDecoratorIdent(d: ts.Decorator)` gets the name of the decorator function
  * `findAnyDecorator(node: ts.Node, patterns, state)` attempts to find any matching decorators as defined in patterns
  * `addImport(file: ts.SourceFile, imports: Import[])` will add an import to the existing source file
  * `fromLiteral(val: any)` converts a literal value to the corresponding AST nodes
  * `extendObjectLiteral(addTo: object, lit?)`  extends an AST Node via a literal value, generally used to emulate `Object.assign` in the AST
  * `getObjectValue(node: ts.ObjectLiteralExpression, key: string)` extracts the literal value from an AST node if possible
  * `importingVisitor` provides a transformer visitor that collects imports, and adds them to the source file as needed
  * `importIfExternal(typeNode: ts.TypeNode, state: State)` will import a reference if the type is not defined within the file
  * `buildImportAliasMap(pathToType)` will generate an import lookup to be used for simple type resolution

Transformations are defined by `support/transformation.<name>.ts` as the filename. The schema for a transformer is 

```typescript
  export class CustomerTransformer {
    priority: 1, // Lower is higher priority
    phase: 'before'|'after', // The phase as defined by Typescript's AST processing
    transformer: (context: ts.TransformationContext) => {
       return (file: ts.SourceFile) => {
         ... modify source file ...
         return file;
       }
    }
  }
```

