travetto: Dependency Injection  
===

[`Dependency injection`](https://en.wikipedia.org/wiki/Dependency_injection) is a framework primitive.  When used in conjunction with automatic file scanning, it provides for handling of application dependency wiring. Due to the nature of `typescript` and type erasure of interfaces, dependency injection only supports `class`es as type signafiers. The primary goal of dependency injection is to allow for separation of concerns of object creation and it's usage. 

## Declaration
The `@Injectable` and `@InjectableFactory` decorators provide the registration of dependencies.   Dependency declaration revolves around exposing `class`es and subtypes thereof to provide necessary functionality.  Additionally, the framework will utilize dependencies to satisfy contracts with various backends (e.g. `ModelMongoSource` provides itself as an injectable candidate for `ModelSource`).  

```typescript
  @Injectable()
  class CustomService {
    async coolOperation() {
      ... work ...
    }
  }
```

When declaring a dependency, you can also provide a token to allow for multiple instances of the dependency to be defined.  This can be used in many situations:

```typescript
  @Injectable()
  class CustomService {
    async coolOperation() {
      ... work ...
    }
  }

  const CUSTOM2 = Symbol('custom2');

  @Injectable({ target: CustomService, symbol: CUSTOM2 })
  class CustomService2 extends CustomService {
    async coolOperation() {
      await super.coolOperation();
      // Do some additional work
    }
  }
```

As you can see, the `target` field is also set, which indicates to the dependency registration process what `class` the injectable is compatible with.  Additionally, when using `abstract` classes, the parent `class` is always considered as a valid candidate type.

```typescript
  abstract class BaseService {
    abstract work():Promise<void>;
  }

  @Injectable()
  class SpecificService extends BaseService {
    async work() {
      // Do some additional work
    }
  }
```

In this scenario, `SpecificService` is a valid candidate for `BaseService` due to the abstract inheritance. Sometimes, you may want to provide a slight variation to  a dependency without extending a class.  To this end, the `@InjectableFactory` decorator denotes a `static` class method that produces an `@Injectable`. 

```typescript
  class Config {
    @InjectableFactory()
    static initService(): CoolService {
      return new CoolService();
    }
  }
```

Given the `static` method `initService`, the function will be provided as a valid candidate for `CoolService`.  Instead of calling the constructor of the type directly, this function will work as a factory for producing the injectable. 

**NOTE** Due to the lack of typechecker in the [`Compiler`](https://github.com/travetto/travetto/tree/master/module/compiler) for performance reasons, the return type on the factory method is mandatory.  Without it, the code will not know what the expected target type should be.

**NOTE** Other modules are able to provide aliases to `@Injectable` that also provide additional functionality.  For example, the `@Config` or the `@Controller` decorator registers the associated class as an injectable element.

## Injection

Once all of your necessary dependencies are defined, now is the time to provide those `@Injectable` instances to your code.  There are three primary methods for injection:

The `@Inject` decorator, which denotes a desire to inject a value directly.  These will be set post construction.
```typescript
  @Injectable()
  class CustomService {
    @Inject()
    private dependentService: DependentService;
    
    async coolOperation() {
      await this.dependentService.doWork();
    }
  }
```

The `@Injectable` constructor params, which will be provided as the instance is being constructed.
```typescript
  @Injectable()
  class CustomService {
    constructor (private dependentService: DependentService) {}
    
    async coolOperation() {
      await this.dependentService.doWork();
    }
  }
```

Via `@InjectableFactory` params, which are comparable to constructor params
```typescript
  class Config {
    @InjectableFactory()
    static initService(dependentService: DependentService): CustomService {
      return new CustomService(dependentService);
    }
  }
```

## Manual Invocation
Some times you will need to lookup a dependency dynamically, or you want to control the injection process at a more granular level. To achieve that you will need to directly access the [`DependencyRegistry`](./src/service/registry.ts). The registry allows for requesting a dependency by class reference:

```typescript
@Injectable()
class Complex {}

class ManualLookup {
  async invoke() {
    const complex = await DependencyRegistry.getInstance(Complex);
  }
}
```

## Application
Given that dependency injection is generally a pre-requisite for application execution, it stands as the primary entrypoint for application invocation.  The [`Base`](https://github.com/travetto/travetto/tree/master/module/base) provides a simplistic bootstrap to allow for the application to run, but that is not sufficient for more complex applications.

The module provides a decorator, `@Application` who's job is to register entry points into the application.  For example:

```typescript
import { Application, Inject, Injectable } from '../';

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

Will expose an entrypoint named 'simple'.  This additionally allows for other entry points to be named for handling specific use cases.  An additional entry point could look like:

```typescript
import { Application, Inject, Injectable } from '../';

@Injectable()
class Server {
  name = 'roger';
  config = { ... };

  async launch() {
    ...
  }
}

@Application('config')
class ConfigApp {

  @Inject()
  server: Server

  async run() {
    console.log(server.configuration);
  }
}
```
