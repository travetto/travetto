<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/app/doc.ts and execute "npx trv doc" to rebuild -->
# Application
## Application registration/management and run support.

**Install: @travetto/app**
```bash
npm install @travetto/app
```

The [Base](https://github.com/travetto/travetto/tree/main/module/base#readme "Application phase management, environment config and common utilities for travetto applications.") module provides a simplistic entrypoint to allow for the application to run, but that is not sufficient for more complex applications. This module provides a decorator, [@Application](https://github.com/travetto/travetto/tree/main/module/app/src/decorator.ts#L21) who's job is to register entry points into the application, along with the associated  metadata. 

With the application, the `run` method is the entry point that will be invoked post construction of the class. Building off of the [Dependency Injection](https://github.com/travetto/travetto/tree/main/module/di#readme "Dependency registration/management and injection support."), the [@Application](https://github.com/travetto/travetto/tree/main/module/app/src/decorator.ts#L21) is a synonym for [@Injectable](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30), and inherits all the abilities of dependency injection.  This should allow for setup for any specific application that needs to be run.

For example:

**Code: Example of Application target**
```typescript
import { Injectable, Inject } from '@travetto/di';
import { Application } from '@travetto/app';

@Injectable()
class Server {
  name = 'roger';

  async launch() {
    // ...
  }
}

@Application('simple-app')
class SimpleApp {

  @Inject()
  server: Server;

  async run() {
    return this.server.launch();
  }
}
```

Additionally, the [@Application](https://github.com/travetto/travetto/tree/main/module/app/src/decorator.ts#L21) decorator exposes some additional functionality, which can be used to launch the application.

## `.run()` Arguments
The arguments specified in the `run` method are extracted via code transformation, and are able to be bound when invoking the application.  Whether from the command line or a plugin, the parameters will be mapped to the inputs of `run`.  For instance:
  

**Code: Simple Entry Point with Parameters**
```typescript
import { Application } from '@travetto/app';

@Application('simple-domain')
class SimpleApp {
  async run(domain: string, port = 3000) {
    console.log('Launching', { domain, port });
  }
}
```

## CLI - run

The run command allows for invocation of applications as defined by the [@Application](https://github.com/travetto/travetto/tree/main/module/app/src/decorator.ts#L21) decorator.  Additionally, the environment can manually be specified (dev, test, prod).

**Terminal: CLI Run Help**
```bash
$ trv run --help

Usage:  run [options] [application] [args...]

Options:
  -e, --env <env>            Application environment
  -p, --profile <profile>    Additional application profiles (default: [])
  -r, --resource <resource>  Additional resource locations (default: [])
  -h, --help                 display help for command

Available Applications:

   ● complex 
     -----------------------------------------------
     usage: complex domain:string [port:number=3000]
     file:  doc/complex.ts

   ● simple 
     ----------------------------------------------
     usage: simple domain:string [port:number=3000]
     file:  doc/simple.ts

   ● simple-app 
     --------------------------
     usage: simple-app 
     file:  doc/entry-simple.ts

   ● simple-domain 
     -----------------------------------------------------
     usage: simple-domain domain:string [port:number=3000]
     file:  doc/domain.ts

   ● test-eptest 
     --------------------------------------------------------
     usage: test-eptest [age:number=5] [format:html|pdf=html]
     file:  doc/entry.ts
```

Running without specifying an application `trv run`, will display all the available apps, and would look like:

**Terminal: Sample CLI Output**
```bash
$ trv run

Usage: trv run [options] [application] [args...]

Options:
  -e, --env <env>            Application environment
  -p, --profile <profile>    Additional application profiles (default: [])
  -r, --resource <resource>  Additional resource locations (default: [])
  -h, --help                 display help for command

Available Applications:

   ● complex 
     -----------------------------------------------
     usage: complex domain:string [port:number=3000]
     file:  doc/complex.ts

   ● simple 
     ----------------------------------------------
     usage: simple domain:string [port:number=3000]
     file:  doc/simple.ts

   ● simple-app 
     --------------------------
     usage: simple-app 
     file:  doc/entry-simple.ts

   ● simple-domain 
     -----------------------------------------------------
     usage: simple-domain domain:string [port:number=3000]
     file:  doc/domain.ts

   ● test-eptest 
     --------------------------------------------------------
     usage: test-eptest [age:number=5] [format:html|pdf=html]
     file:  doc/entry.ts
```

To invoke the `simple` application, you need to pass `domain` where port is optional with a default.
  

**Terminal: Invoke Simple**
```bash
$ trv run simple-domain mydomain.biz 4000

Running application { name: 'simple-domain', filename: './doc/domain.ts' }
Manifest {
  info: {
    framework: '2.0.0',
    name: '@travetto/app',
    description: 'Application registration/management and run support.',
    version: '2.0.0',
    license: 'MIT',
    author: { email: 'travetto.framework@gmail.com', name: 'Travetto Framework' }
  },
  env: {
    name: 'dev',
    profiles: [ 'application', 'dev' ],
    prod: false,
    debug: { status: false, value: undefined },
    resources: [ 'resources', 'doc/resources' ],
    shutdownWait: 2000,
    cache: '.trv_cache',
    node: 'v15.14.0',
    dynamic: false,
    readonly: false
  },
  source: {
    common: [ 'src' ],
    local: [ 'doc' ],
    excludeModules: Set(3) { '@travetto/cli', '@travetto/doc', '@travetto/boot' },
    dynamicModules: {
      '@travetto/base': '@trv:base',
      '@travetto/boot': '@trv:boot',
      '@travetto/cli': '@trv:cli',
      '@travetto/compiler': '@trv:compiler',
      '@travetto/config': '@trv:config',
      '@travetto/di': '@trv:di',
      '@travetto/doc': '@trv:doc',
      '@travetto/log': '@trv:log',
      '@travetto/registry': '@trv:registry',
      '@travetto/schema': '@trv:schema',
      '@travetto/test': '@trv:test',
      '@travetto/transformer': '@trv:transformer',
      '@travetto/watch': '@trv:watch',
      '@travetto/worker': '@trv:worker',
      '@travetto/yaml': '@trv:yaml'
    }
  }
}
Config
Launching { domain: 'mydomain.biz', port: 4000 }
```

## Type Checking

The parameters to `run` will be type checked, to ensure proper evaluation.

**Terminal: Invoke Simple with bad port**
```bash
$ trv run simple-domain mydomain.biz orange

Failed to run simple-domain, Validation errors have occurred
● port is not a valid number
```

The types are inferred from the `.run()` method parameters, but can be overridden in the [@Application](https://github.com/travetto/travetto/tree/main/module/app/src/decorator.ts#L21) 
annotation to support customization. Only primitive types are supported:

   
   *  `number` - Float or decimal
   *  `string` - Default if no type is specified
   *  `boolean` - true(yes/on/1) and false(no/off/0)
   *  `union` - Type unions of the same type (`string_a | string_b` or `1 | 2 | 3 | 4`)
  
Customizing the types is done by name, and allows for greater control:

**Code: Complex Entry Point with Customization**
```typescript
import { Application } from '@travetto/app';

@Application('complex')
class Complex {
  async run(domain: string, port: number = 3000) {
    console.log('Launching', { domain, port });
  }
}
```
