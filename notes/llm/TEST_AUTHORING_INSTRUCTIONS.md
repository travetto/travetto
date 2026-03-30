# Travetto Test Authoring Instructions

Guide for writing and maintaining test files across the Travetto framework.

## Test Infrastructure Overview

Travetto uses a custom test framework (`@travetto/test`) built on decorators and Node.js `assert`. Tests live in `module/<name>/test/` directories and shared test suites live in `module/<name>/support/test/`. Cross-module integration tests live in `global-test/` subdirectories.

## Running Tests

```bash
# Run all tests in a module
npm test 'module/model-memory/**'

# Run the trv test CLI directly
trv test -f tap-summary

# Run a specific test file
trv test module/schema/test/validation.ts
```

The root `package.json` scripts:
- `pretest` — starts required services (`trv service start -q`)
- `test` — runs all tests (`trv test -f tap-summary`)

## File Structure

Test files are TypeScript files in the `test/` directory of each module:

```
module/my-module/
  test/
    feature-a.ts        # Test suite file
    feature-b.ts        # Another suite
    models/             # Shared test models (optional)
    fixtures/           # Test fixture data (optional)
  support/
    test/
      suite.ts          # Shared base suite (reusable by other modules)
      base.ts           # Abstract base class
```

## Core Decorators

### `@Suite(description?)`

Registers a class as a test suite. Applied to a class.

```ts
import { Suite, Test } from '@travetto/test';

@Suite()
class MyFeatureTest {
  // tests go here
}

// With a description
@Suite('My Feature - Edge Cases')
class MyFeatureEdgeCases {
  // tests go here
}
```

### `@Test(description?)`

Registers a method as a test. Must be inside a `@Suite()` class. Methods should be `async`.

```ts
@Suite()
class MyTest {
  @Test()
  async basicFunctionality() {
    // test logic
  }

  @Test('should handle edge case')
  async edgeCase() {
    // test logic
  }
}
```

### `@Test()` with Options

The `@Test()` decorator accepts a config object with additional options:

```ts
@Test({ timeout: 15000 })
async longRunningTest() { }

@Test({ skip: true })
async notReadyYet() { }

@Test({ skip: () => !global.gc })
async requiresGC() { }

@Test({ skip: BaseModelSuite.ifNot(SomeUtil.isSupported) })
async conditionalTest() { }

@Test({ shouldThrow: ValidationResultError })
async shouldFail() { }
```

### `@ShouldThrow(error)`

Marks a test as expected to throw. Accepts an error class, string, regex, or predicate function.

```ts
@Test()
@ShouldThrow(ValidationResultError)
async invalidInput() {
  await SchemaValidator.validate(MySchema, invalidData);
}

@Test()
@ShouldThrow('dependency')
async cyclicalDependency() {
  await DependencyRegistryIndex.getInstance(CyclicalClass);
}
```

### `@Timeout(ms)`

Sets a custom timeout for a specific test method.

```ts
@Test()
@Timeout(30000)
async slowOperation() { }
```

### Lifecycle Hooks

```ts
@Suite()
class MyTest {
  @BeforeAll()
  async setupOnce() {
    // Runs once before any test in the suite
    await Registry.init();
  }

  @BeforeEach()
  async setupEach() {
    // Runs before every test
  }

  @AfterEach()
  async teardownEach() {
    // Runs after every test
  }

  @AfterAll()
  async teardownOnce() {
    // Runs once after all tests complete
  }
}
```

## Assertions

Tests use Node.js built-in `assert` module. The framework's compiler transformer enhances assert calls to provide detailed failure messages automatically.

```ts
import assert from 'node:assert';

// Basic assertions
assert(value === expected);
assert.ok(value);
assert(result !== undefined);

// Equality
assert(user.age === 30);
assert.equal(config.name, 'Oscar');
assert.deepStrictEqual(result.props.child, { name: [1, 2, 3] });

// Throws
assert.throws(doWork, Error);

// Async rejects
await assert.rejects(
  () => SchemaValidator.validate(MySchema, badData),
  ValidationResultError
);

// Explicit failure
assert.fail('Should not reach here');
```

### `@AssertCheck()`

Used on helper methods (not test methods) that contain assert calls. The compiler transformer needs this hint to transform assertions in non-`@Test` methods.

```ts
@AssertCheck()
checkArgs(result: ParsedArgs, expected: Record<string, unknown>) {
  for (const [key, value] of Object.entries(expected)) {
    assert.deepStrictEqual(result[key], value);
  }
}
```

## Common Patterns

### Pattern 1: Unit Test (Self-Contained)

Simple tests with no external dependencies:

```ts
import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';

@Suite()
export class UtilTest {
  @Test()
  verifyUUID() {
    assert(Util.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));
  }
}
```

### Pattern 2: Registry-Dependent Test

Tests that need the DI/registry system initialized:

```ts
import assert from 'node:assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';

@Suite()
class ServiceTest {
  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async testService() {
    const inst = await DependencyRegistryIndex.getInstance(MyService);
    assert.ok(inst);
  }
}
```

### Pattern 3: Injectable Suite (DI-Powered Tests)

When tests need `@Inject()` fields populated automatically:

```ts
import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test/suite.ts';

@Suite()
@InjectableSuite()
class InjectedTest {
  @Inject()
  myService: MyService;

  @Test()
  async testWithInjection() {
    assert.ok(this.myService);
    const result = await this.myService.doWork();
    assert(result.success);
  }
}
```

### Pattern 4: Model Implementation Conformance

Model providers validate contract compliance by extending shared base suites. Each base suite contains a full set of tests; the implementor only specifies `serviceClass` and `configClass`:

```ts
import { Suite } from '@travetto/test';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelBlobSuite } from '@travetto/model/support/test/blob.ts';

@Suite()
class MemoryBasicSuite extends ModelBasicSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
class MemoryCrudSuite extends ModelCrudSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}
```

Available shared model suites:
- `ModelBasicSuite` — basic create/get/not-found
- `ModelCrudSuite` — full CRUD, partial updates, dates, BigInt
- `ModelExpirySuite` — TTL, aging, auto-expiry
- `ModelBlobSuite` — binary read/write, metadata, streams
- `ModelBulkSuite` — bulk insert/upsert/update/delete
- `ModelPolymorphismSuite` — subtypes with discriminator fields
- `ModelIndexedSuite` — indexed queries, pagination, upsert-by-index
- `ModelQuerySuite` — query operators, sorting, text search
- `ModelQueryCrudSuite` — update-by-query
- `ModelQueryFacetSuite` — facet aggregation
- `ModelQuerySuggestSuite` — value suggestions
- `ModelQueryPolymorphismSuite` — polymorphic queries

### Pattern 5: Extending Shared Suites with Extra Tests

Implementations can add module-specific tests alongside inherited ones:

```ts
@Suite()
class MongoBasicSuite extends ModelBasicSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;

  @Test()
  async testId() {
    const svc = await this.service;
    const user = await svc.create(UniqueUser, UniqueUser.from({ name: 'bob' }));
    assert(user.id.length === 32);
  }
}
```

### Pattern 6: Conditional/Skip Tests

Tests can be conditionally skipped based on runtime capabilities:

```ts
// Skip if GC is not exposed
@Test({ skip: () => !global.gc })
async ensureCulled() { }

// Skip if the service doesn't support the feature
@Test({ skip: BaseModelSuite.ifNot(ModelBlobUtil.isWriteUrlSupported) })
async testSignedUrls() { }

// Static skip
@Test({ skip: true })
async notImplementedYet() { }
```

The `BaseModelSuite.ifNot()` helper creates skip predicates from capability checks:

```ts
static ifNot(pred: (svc: unknown) => boolean): (x: unknown) => Promise<boolean> {
  return async (x: unknown) => !pred(classConstruct(castTo<ServiceClass>(x).serviceClass));
}
```

### Pattern 7: Cross-Module Integration Tests (global-test)

Tests that require multiple modules wired together live in `global-test/`. Each directory is a standalone package combining modules:

```
global-test/model_cache/
  package.json          # Dependencies for the integration
  test/
    memory.ts           # Cache + memory model
    mongo.ts            # Cache + mongo model
    redis.ts            # Cache + redis model
```

These tests typically wire up a specific model service via `@InjectableFactory`:

```ts
import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
class MemoryCacheSuite extends CacheServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}
```

### Pattern 8: Web/Controller Tests

Web tests use the dispatcher pattern for testing controllers without a running HTTP server:

```ts
import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

@Suite()
class BasicStandardTest extends StandardWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
```

### Pattern 9: Multiple Suite Decorators

Complex tests can combine multiple suite decorators for layered lifecycle management:

```ts
@Suite()
@ModelSuite(CacheModelSymbol)
@InjectableSuite()
export abstract class CacheServiceSuite {
  serviceClass: Class<ModelExpirySupport>;
  configClass: Class;

  @Inject()
  testService: SampleService;

  @Test()
  async basic() { }
}
```

### Pattern 10: Test Models and Fixtures

#### Inline Test Models

Define models directly in the test file or a nearby `models/` directory:

```ts
import { Model } from '@travetto/model';
import { Schema } from '@travetto/schema';

@Model()
class TestPerson {
  id: string;
  name: string;
  age: number;
}

@Schema()
class Address {
  street1: string;
  city: string;
  zip: number;
}
```

#### Test Fixtures

Use `TestFixtures` for file-based test data:

```ts
import { TestFixtures } from '@travetto/test';

const fixtures = new TestFixtures();
const data = await fixtures.readUTF8('sample.json');
const stream = await fixtures.readBinaryStream('image.png');
```

Fixture files are resolved from `test/fixtures/` and `support/fixtures/` directories.

## Shared Test Suite Authoring

When creating a new reusable test suite (e.g., for a new model contract):

### 1. Create the abstract base suite

Place in `module/<name>/support/test/<feature>.ts`:

```ts
import assert from 'node:assert';
import { Test } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

export abstract class ModelFeatureSuite extends BaseModelSuite<MyServiceType> {
  @Test()
  async testFeatureA() {
    const svc = await this.service;
    // test logic using svc
  }

  @Test()
  async testFeatureB() {
    const svc = await this.service;
    // test logic using svc
  }
}
```

### 2. Create the lifecycle decorator (if needed)

Place in `module/<name>/support/test/suite.ts`:

```ts
import { SuiteRegistryIndex, type SuitePhaseHandler } from '@travetto/test';

class MyHandler<T extends { serviceClass: Class }> implements SuitePhaseHandler<T> {
  async beforeAll(instance: T) { /* init */ }
  async beforeEach(instance: T) { /* setup */ }
  async afterEach(instance: T) { /* cleanup */ }
  async afterAll(instance: T) { /* teardown */ }
}

export function MySuite() {
  return (target: Class) => {
    SuiteRegistryIndex.getForRegister(target).register({
      phaseHandlers: [new MyHandler(target)]
    });
  };
}
```

### 3. Implementors extend and configure

```ts
@Suite()
class ConcreteFeatureSuite extends ModelFeatureSuite {
  serviceClass = ConcreteService;
  configClass = ConcreteConfig;
}
```

## Key Infrastructure Details

### `@ModelSuite(qualifier?)`

The `ModelSuite` decorator provides full model lifecycle management:
- **beforeAll** — `Registry.init()`, randomized namespace, disable `autoCreate`
- **beforeEach** — `createStorage()`, upsert all registered models
- **afterEach** — truncate/delete all models, cleanup blobs
- **afterAll** — full cleanup, `deleteStorage()`

### `toConcrete<T>()`

Use `toConcrete` from `@travetto/runtime` to get the concrete class backing a TypeScript interface. Useful for DI lookups in tests:

```ts
const contract = toConcrete<MyInterface>();
const instance = await DependencyRegistryIndex.getInstance(contract);
```

### Error Handling in Tests

Two primary approaches:

**1. try/catch with assertion:**
```ts
@Test()
async validateInput() {
  try {
    await SchemaValidator.validate(Response, badData);
    assert.fail('Validation should have failed');
  } catch (err) {
    assert(err instanceof ValidationResultError);
    assert(err.details.errors.length > 0);
  }
}
```

**2. `@ShouldThrow` decorator:**
```ts
@Test()
@ShouldThrow(ValidationResultError)
async validateInput() {
  await SchemaValidator.validate(Response, badData);
}
```

**3. `assert.rejects`:**
```ts
@Test()
async validateInput() {
  await assert.rejects(
    () => SchemaValidator.validate(Response, badData),
    ValidationResultError
  );
}
```

### `ThrowableError` Types

`@ShouldThrow` and `shouldThrow` option accept:
- **Error class**: `ShouldThrow(ValidationResultError)` — matches by `instanceof`
- **String**: `ShouldThrow('dependency')` — matches if error message contains the string
- **RegExp**: `ShouldThrow(/not found/i)` — matches against error message
- **Function**: `ShouldThrow((err) => err.code === 404)` — custom predicate

## Style Guidelines

1. **One suite per file** — each test file typically contains one `@Suite()` class, sometimes more for closely related scenarios.
2. **Descriptive test names** — use `@Test('description')` or rely on method names that read as behavior descriptions.
3. **Async by default** — all test methods should be `async`, even if synchronous, for consistency.
4. **Import assert from node** — always `import assert from 'node:assert'`, never from other sources.
5. **Registry init** — if tests involve DI, schema, or model registries, call `await Registry.init()` in `@BeforeAll()`.
6. **Schema `from()`** — use `MyModel.from({...})` to construct schema-bound objects in tests.
7. **Clean up after yourself** — shared suites use `@ModelSuite` for automatic cleanup; standalone tests should manually clean up resources.
8. **Shared suites are abstract** — base test suites should be `abstract` classes requiring `serviceClass` and `configClass` to be set by the concrete implementation.
9. **No test interdependence** — tests should not rely on execution order or state from other tests.
10. **Use `castTo` / `asFull` for type coercion** — when deliberately testing invalid data, use runtime cast utilities rather than `@ts-ignore`.
