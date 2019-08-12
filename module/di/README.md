travetto: Dependency Injection  
===

**Install: primary**
```bash
$ npm install @travetto/di
```

[`Dependency injection`](https://en.wikipedia.org/wiki/Dependency_injection) is a framework primitive.  When used in conjunction with automatic file scanning, it provides for handling of application dependency wiring. Due to the nature of `typescript` and type erasure of interfaces, dependency injection only supports `class`es as type signafiers. The primary goal of dependency injection is to allow for separation of concerns of object creation and it's usage. 

## Declaration
The `@Injectable` and `@InjectableFactory` decorators provide the registration of dependencies.   Dependency declaration revolves around exposing `class`es and subtypes thereof to provide necessary functionality.  Additionally, the framework will utilize dependencies to satisfy contracts with various backends (e.g. `MongoModelSource` provides itself as an injectable candidate for `ModelSource`).  

**Code: Example @Injectable**
```typescript
  @Injectable()
  class CustomService {
    async coolOperation() {
      ... work ...
    }
  }
```

When declaring a dependency, you can also provide a token to allow for multiple instances of the dependency to be defined.  This can be used in many situations:

**Code: Example @Injectable with multiple targets**
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

  class Consumer {
    @Inject(CUSTOM2) // Pull in specific service 
    service: CustomService;
  }
```

As you can see, the `target` field is also set, which indicates to the dependency registration process what `class` the injectable is compatible with.  Additionally, when using `abstract` classes, the parent `class` is always considered as a valid candidate type.

**Code: Example @Injectable with target via abstract class**
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

**Code: Example @InjectableFactory, return type defines target class**
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

**Code: Example @Injectable with dependencies as @Inject fields**
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

**Code: Example @Injectable with dependencies in constructor**
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

**Code: Example @InjectableFactory with parameters as dependencies**
```typescript
  class Config {
    @InjectableFactory()
    static initService(dependentService: DependentService): CustomService {
      return new CustomService(dependentService);
    }
  }
```

**NOTE** If you are building modules for others to consume, often times it is desirable to have default implementations for contracts that can be overridden.  The `@Inject` decorator takes a flag of `defaultIfMissing` and a class name, that it will use to satisfy the dependency if nothing else matches.  This would look like:

**Code: Example of default if missing**
```typescript
  abstract class Contract {

  }

  @Injectable({ targets: SimpleContract })
  class SimpleContract extends Contract {}

  @Injectable({ targets: ComplexContract })
  class ComplexContract extends Contract {}

  @Injectable()
  class ContractConsumer {
    // Will default to SimpleContract if nothing else registered
    @Inject({ defaultIfMissing: SimpleContract })
    contract: Contract;
  }

  
  class Config {
    // Complex will be marked as the available Contract
    @InjectableFactory()
    getContract(complex: ComplexContract): Contract { 
      return complex;
    }
  }
```

## Manual Invocation
Some times you will need to lookup a dependency dynamically, or you want to control the injection process at a more granular level. To achieve that you will need to directly access the [`DependencyRegistry`](./src/service/registry.ts). The registry allows for requesting a dependency by class reference:

**Code: Example of manual lookup**
```typescript
@Injectable()
class Complex {}

class ManualLookup {
  async invoke() {
    const complex = await DependencyRegistry.getInstance(Complex);
  }
}
```