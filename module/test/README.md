travetto: Test
===

This module provides unit testing functionality that integrates with the framework. It is a declarative framework, using decorators to define tests and suites. The test produces results in the [`TAP 13`](https://testanything.org/tap-version-13-specification.html) format. 

The [`test-plugin`](https://www.github.com/travetto/test-plugin) directly integrates with the module to provide real-time feedback on unit tests. 

## Definition
A test suite is a collection of individual tests.  All test suites are classes with the `@Suite` decorator. Tests are defined as methods on the suite class, using the `@Test` decorator.  All tests intrinsically support async/await.  

Additionally, the the suite classes support [`Dependency Injection`](https://github.com/travetto/travetto/tree/master/module/di).

A simple example would be:
```typescript
import * as assert from 'assert';

@Suite()
class SimpleTest {

  private complexService: ComplexService;

  @Test()
  async test1() {
    let val = await this.complexService.doLongOp();
    assert(val === 5);
  }

  @Test()
  test2() {
    assert(/abc/.test(text));
  }
}
```

## Assertions
A common aspect of the tests themselves are the assertions that are made.  `Node` provides a built-in [`assert`](https://nodejs.org/api/assert.html) library.  The framework uses AST transformations to modify the assertions to provide integration with the test module, and to provide a much higher level of detail in the failed assertions. 

For example:
```typescript
assert({size: 20, address: { state: 'VA' }} === {});
```

would generate the error:

```typescript
AssertionError(
  message="{size: 20, address: {state: 'VA' }} should deeply strictly equal {}"
)
```

## Execution
`travetto-test` is packaged as a included script to execute tests from the command line.  The script can be invoked as 

```bash
./node_modules/.bin/travetto-test test/.*
```

All tests should be under the `test/.*` folders.  The pattern for tests is defined as a regex and not standard globbing.