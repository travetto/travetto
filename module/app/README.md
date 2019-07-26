travetto: Application
===

**Install: primary**
```bash
$ npm install @travetto/app
```
The [`Base`](https://github.com/travetto/travetto/tree/master/module/base) module provides a simplistic bootstrap to allow for the application to run, but that is not sufficient for more complex applications. This module provides a decorator, `@Application` who's job is to register entry points into the application, along with the associated metadata. 

With the application, the `run` method is the entry point that will be invoked post construction of the class. Building off of the [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di), the `@Application` is a synonym for `@Injectable`, and inherits all the abilities of dependency injection.  This should allow for setup for any specific application that needs to be run.

For example:

**Code: Example of @Application target**
```typescript
import { Inject, Injectable } from '@travetto/di';
import { Application } from '../';

@Injectable()
class Server {
  name = 'roger';

  async launch() {
    ...
  }
}

@Application('simple')
class SimpleApp {

  @Inject()
  server: Server

  async run() {
    return this.server.launch();
  }
}
```

Additionally, the `@Application` decorator exposes some additional functionality, which can be used to launch the application. 

### `.run()` Arguments

The arguments specified in the `run` method are extracted via code transformation, and are able to be bound when invoking the application.  Whether from the command line or a plugin, the parameters will be mapped to the inputs of `run`.  For instance:

**Code: Simple Entry Point with Parameters**
```typescript
@Application('simple')
class SimpleApp {
  async run(domain: string, port = 3000) {
    console.log('Launching', domain, 'on port', port);
  }
}
```

These command line invocation of `travetto run` would look like:

**Terminal: Sample CLI Output**
```bash
$ travetto run
....

     ● [e2e] simple
       ----------------------------------
       usage: simple [domain] (port=3000)
```

To invoke the `simple` application, you need to pass `domain` where port is optional with a default.

**Terminal: Invoke Simple**
```bash
$ travetto run simple mydomain.biz 4000

[INFO] Launching mydomain.biz on port 4000
```

### Type Checking

The parameters to `run` will be type checked, to ensure proper evaluation.

**Terminal: Invoke Simple with bad port**
```bash
$ travetto run simple mydomain.biz orange
usage: simple domain (string), port=[3000] (number)
```

The types are inferred from the `.run()` method parameters, but can be overridden in the `@Application` annotation to support customization. Only primitive types are supported:
* `number` - Float or decimal
* `string` - Default if no type is specified
* `boolean` - true(yes/on/1) and false(no/off/0)
* `union` - Type unions of the same type (`string_a|string_b` or `1|2|3|4`)

Customizing the types is done by name, and allows for greater control:

**Code: Complex Entry Point with Customization**
```typescript
@Application('complex', {
  watchable: true,
  paramMap: {
    domain: {
      title: 'Domain Name',
      type: 'string',
      subtype: 'url'      
    },
    port : {
      title: 'Server Port',
      def: 3000
    }
  }
})
class ComplexApp {
  async run(domain: string, port: number) {
    console.log('Launching', domain, 'on port', port);
  }
}
```

**Note**
The applications, by default, will not scan other application's folders.  This means, if you have an application in the `e2e/` folder, all of the code in your `src/` folder will not be picked up automatically.  This defined under the assumption that each application is unique.  If you have an application that is an extension of the primary application (`src/`), you can specify the `@Application` config property of `standalone` to be false.  This will now scan both folders to run your application.