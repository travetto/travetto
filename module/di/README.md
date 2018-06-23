travetto: Dependency Injection  
===
Dependency injection is provided as a best practice, and as a framework primitive. Dependency injection
can be achieved in multiple ways to support different software patterns. Dependency injection only supports
classes as the class is the lookup key.

## General Usage

Dependency injection revolves around the following paradigms:
* `@Injectable` decorator denotes that a class can be injected.
```typescript
  @Injectable()
  class CustomService {
    async coolOperation() {
      ... work ...
    }
  }
```
* `@InjectableFactory` decorator denotes a static class method that produces an `@Injectable`
```typescript
  class Config {
    @InjectableFactory()
    static initService(): CoolService {
      return new CoolService();
    }
  }
```
* `@Inject` decorator denotes a desire to inject a value directly
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
* `@Injectable` constructor params
```typescript
  @Injectable()
  class CustomService {
    constructor (private dependentService: DependentService) {}
    
    async coolOperation() {
      await this.dependentService.doWork();
    }
  }
```
* `@InjectableFactory` params 
```typescript
  class Config {
    @InjectableFactory()
    static initService(dependentService: DependentService): CustomService {
      return new CustomService(dependentService);
    }
  }
```

## Manual Invocation
Some times you will need to lookup a dependency dynamically, or you want to control the injection process at a more granular level.
To achieve that you will need to directly access the [`DependencyRegistry`](./src/service/registry.ts).

The registry allows for requesting a dependency by class reference.

```typescript
@Injectable()
class Complex {}

class ManualLookup {
  async invoke() {
    const complex = await DependencyRegistry.getInstance(Complex);
  }
}
```

## Advanced Usage
In addition to the standard operations, you are able to create multiple versions of the same dependency by providing a qualifier at registration time and
at injection time.  This allows you to have multiple database connections, or multiple email services.

```typescript
const USER_DB = Symbol('USER_DB');
const ASSET_DB = Symbol('ASSET_DB');

class DBConfig {
  host: string;
}

class Factory {
  @InjectableFactory(USER_DB)
  getUserConfig(): DBConfig {
    const conf = new DBConfig();
    conf.host = 'user';
    return conf;
  }

  @InjectableFactory(USER_DB)
  getAssetConfig(): DBConfig {
    const conf = new DBConfig();
    conf.host = 'asset';
    return conf;
  }
  
}

class UserService {
  constructor(@Inject(USER_DB) config:DBConfig) {}
}
```
