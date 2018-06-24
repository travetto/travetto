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
  * Utilizes `es2015` ```Proxy```s to allow for swapping out implementation at runtime

Additionally, there is support for common AST transformation patterns to facilitate all the transformers used throughout the framework. Functionality includes:
  * ```getDecoratorIdent(d: ts.Decorator): ts.Identifier```
   Gets the name of the decorator function
  * ```findAnyDecorator(node: ts.Node, patterns: { [key: string]: Set<string> }, state: State): ts.Decorator | undefined ```
  Attempts to find any matching decorators as defined in patterns
  * ```addImport(file: ts.SourceFile, imports: Import[])```
  Will add an import to the existing source file
  * ```fromLiteral(val: any)```
  Converts a literal value to the corresponding AST nodes
  * ```extendObjectLiteral(addTo: object, lit?: ts.ObjectLiteralExpression)```  
  Extends an AST Node via a literal value, generally used to emulate ```Object.assign``` in the AST
  * ```getPrimaryArgument<T = ts.Node>(node: ts.CallExpression | ts.Decorator | undefined): T | undefined```
  Retrieves the first argument of CallExpression or Decorator
  * ```getObjectValue(node: ts.ObjectLiteralExpression | undefined, key: string)``` 
  Extracts the literal value from an AST node if possible
  * ```importingVisitor``` 
  Provides a transformer visitor that collects imports, and adds them to the source file as needed
  * ```importIfExternal<T extends State>(typeNode: ts.TypeNode, state: State)``` 
  Will import a reference if the type is not defined within the file
  * ```buildImportAliasMap(pathToType)``` 
  Will generate an import lookup to be used for simple type resolution

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