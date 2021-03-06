<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/di/doc.ts and execute "npx trv doc" to rebuild -->
# Dependency Injection
## Dependency registration/management and injection support.

**Install: @travetto/di**
```bash
npm install @travetto/di
```

[Dependency injection](https://en.wikipedia.org/wiki/Dependency_injection) is a framework primitive.  When used in conjunction with automatic file scanning, it provides for handling of application dependency wiring. Due to the nature of [Typescript](https://typescriptlang.org) and type erasure of interfaces, dependency injection only supports `class`es as type signafiers. The primary goal of dependency injection is to allow for separation of concerns of object creation and it's usage.

## Declaration
The [@Injectable](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30) and [@InjectableFactory](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L72) decorators provide the registration of dependencies.   Dependency declaration revolves around exposing `class`es and subtypes thereof to provide necessary functionality.  Additionally, the framework will utilize dependencies to satisfy contracts with various implementations (e.g. [MongoModelService](https://github.com/travetto/travetto/tree/main/module/model-mongo/src/service.ts#L42) provides itself as an injectable candidate for [ModelCrudSupport](https://github.com/travetto/travetto/tree/main/module/model/src/service/crud.ts).

**Code: Example Injectable**
```typescript
import { Injectable } from '@travetto/di';

@Injectable()
class CustomService {
  async coolOperation() {
    // Do work!
  }
}
```

When declaring a dependency, you can also provide a token to allow for multiple instances of the dependency to be defined.  This can be used in many situations:

**Code: Example Injectable with multiple targets**
```typescript
import { Injectable, Inject } from '@travetto/di';

@Injectable()
class CustomService {
  async coolOperation() {
    // do work!
  }
}

const CUSTOM2 = Symbol.for('di-custom2');

@Injectable({ target: CustomService, qualifier: CUSTOM2 })
class CustomService2 extends CustomService {
  override async coolOperation() {
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

**Code: Example Injectable with target via abstract class**
```typescript
import { Injectable } from '@travetto/di';

abstract class BaseService {
  abstract work(): Promise<void>;
}

@Injectable()
class SpecificService extends BaseService {
  async work() {
    // Do some additional work
  }
}
```

In this scenario, `SpecificService` is a valid candidate for `BaseService` due to the abstract inheritance. Sometimes, you may want to provide a slight variation to  a dependency without extending a class.  To this end, the [@InjectableFactory](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L72) decorator denotes a `static` class method that produces an [@Injectable](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30).

**Code: Example InjectableFactory**
```typescript
import { InjectableFactory } from '@travetto/di';

// Not injectable by default
class CoolService {

}

class Config {
  @InjectableFactory()
  static initService() {
    return new CoolService();
  }
}
```

Given the `static` method `initService`, the function will be provided as a valid candidate for `CoolService`.  Instead of calling the constructor of the type directly, this function will work as a factory for producing the injectable.

**Note**: Other modules are able to provide aliases to [@Injectable](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30) that also provide additional functionality.  For example, the [@Config](https://github.com/travetto/travetto/tree/main/module/config/src/decorator.ts#L9) or the [@Controller](https://github.com/travetto/travetto/tree/main/module/rest/src/decorator/controller.ts#L9) decorator registers the associated class as an injectable element.

## Injection

Once all of your necessary dependencies are defined, now is the time to provide those [@Injectable](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30) instances to your code.  There are three primary methods for injection:

The [@Inject](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30) decorator, which denotes a desire to inject a value directly.  These will be set post construction.

**Code: Example Injectable with dependencies as [@Inject](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30) fields**
```typescript
import { Injectable, Inject } from '@travetto/di';
import { DependentService } from './dep';

@Injectable()
class CustomService {
  @Inject()
  private dependentService: DependentService;

  async coolOperation() {
    await this.dependentService.doWork();
  }
}
```

The [@Injectable](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L30) constructor params, which will be provided as the instance is being constructed.

**Code: Example Injectable with dependencies in constructor**
```typescript
import { Injectable } from '@travetto/di';
import { DependentService } from './dep';

@Injectable()
class CustomService {
  constructor(private dependentService: DependentService) { }

  async coolOperation() {
    await this.dependentService.doWork();
  }
}
```

Via [@InjectableFactory](https://github.com/travetto/travetto/tree/main/module/di/src/decorator.ts#L72) params, which are comparable to constructor params

**Code: Example InjectableFactory with parameters as dependencies**
```typescript
import { InjectableFactory } from '@travetto/di';

import { DependentService, CustomService } from './dep';

class Config {
  @InjectableFactory()
  static initService(dependentService: DependentService) {
    return new CustomService(dependentService);
  }
}
```

### Multiple Candidates for the Same Type

If you are building modules for others to consume, often times it is possible to end up with multiple implementations for the same class.  

**Code: Example Multiple Candiate Types**
```typescript
import { Injectable, Inject } from '@travetto/di';

export abstract class Contract {

}

@Injectable()
class SimpleContract extends Contract { }

@Injectable()
export class ComplexContract extends Contract { }

@Injectable()
class ContractConsumer {
  // Will default to SimpleContract if nothing else registered
  @Inject()
  contract: Contract;
}
```

By default, if there is only one candidate without qualification, then that candidate will be used.  If multiple candidates are found, then the injection system will bail.  To overcome this the end user will need to specify which candidate type should be considered `primary`:

**Code: Example Multiple Candiate Types**
```typescript
import { InjectableFactory } from '@travetto/di';
import { Contract, ComplexContract } from './injectable-multiple-default';

class Config {
  // Complex will be marked as the available Contract
  @InjectableFactory({ primary: true })
  static getContract(complex: ComplexContract): Contract {
    return complex;
  }
}
```

## Manual Invocation

Some times you will need to lookup a dependency dynamically, or you want to control the injection process at a more granular level. To achieve that you will need to directly access the [DependencyRegistry](https://github.com/travetto/travetto/tree/main/module/di/src/registry.ts). The registry allows for requesting a dependency by class reference:

**Code: Example of Manual Lookup**
```typescript
import { Injectable, DependencyRegistry } from '@travetto/di';

@Injectable()
class Complex { }

class ManualLookup {
  async invoke() {
    const complex = await DependencyRegistry.getInstance(Complex);
    return complex;
  }
}
```
