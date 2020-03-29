Travetto: Registry
=================

**Install: primary**
```bash
$ npm install @travetto/registry
```

This module is the backbone for all "discovered" and "registered" behaviors within the framework. This is primarily used for building modules within the framework and not directly useful for application development.

## Flows
Registration, within the framework flows throw two main use cases:

### Initial Flow (Primary)
The primary flow occurs on initialization of the application. At that point, the module will:
1. Initialize `RootRegistry` and will automatically register/load all relevant files
2. As files are imported, decorators within the files will record various metadata relevant to the respective registries 
3. When all files are processed, the `RootRegistry` is finished, and it will signal to anything waiting on registered data that its free to use it.  
This flow ensures all files are loaded and processed before application starts. A sample registry, pulled from the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module, looks like:

**Code: Custom Registry based on Metadata Registry**
```typescript
export class $ModelRegistry extends MetadataRegistry<ModelOptions<any>> {
  constructor() {
    super(SchemaRegistry, DependencyRegistry);
  }

  createPending(cls: Class) {
    return { class: cls };
  }

  onInstallFinalize<T>(cls: Class<T>) {
    return this.pending.get(cls.__id)! as ModelOptions<T>;
  }
}
```

The registry is a `MetadataRegistry` that depends on the `SchemaRegistry` and the `DependencyRegistry`.

### Live Flow
At runtime, the registry is designed to listen for changes and to propagate the changes as necessary. In many cases the same file is handled by multiple registries.

As the [`Compiler`](https://github.com/travetto/travetto/tree/master/module/compiler) notifies that a file has been changed and recompiled, the `RootRegistry` will pick it up, and process it accordingly.

## Supporting Metadata
For the registries to work properly, metadata needs to be collected about files and classes to uniquely identify them, especially across file reloads for the live flow.  To achieve this, every `class` is decorated with additional fields.  The data that is added is:
* `__file` denotes the fully qualified path name of the class
* `__id` represents a computed id that is tied to the file/class combination
* `__hash` a quick and dirty hash of the contents of the class to be able to quickly determine if a class has changed or not
* `__methods` a map of hashes for each class method to be able to determine if the method contents have changed
* `__abstract` a flag to determine if the type is abstract or not.
