travetto: Test
===

**Install: primary**
```bash
$ npm install @travetto/test
```

This module provides unit testing functionality that integrates with the framework. It is a declarative framework, using decorators to define tests and suites. The test produces results in the [`TAP 13`](https://testanything.org/tap-version-13-specification.html) format to be consumed by other processes. 

**NOTE** All tests should be under the `test/.*` folders.  The pattern for tests is defined as a regex and not standard globbing.

## Definition
A test suite is a collection of individual tests.  All test suites are classes with the `@Suite` decorator. Tests are defined as methods on the suite class, using the `@Test` decorator.  All tests intrinsically support `async`/`await`.  

A simple example would be:

**Code: Example Test suite**
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
A common aspect of the tests themselves are the assertions that are made.  `Node` provides a built-in [`assert`](https://nodejs.org/api/assert.html) library.  The framework uses AST transformations to modify the assertions to provide integration with the test module, and to provide a much higher level of detail in the failed assertions.  For example:

**Code: Example assertion for deep comparison**
```typescript
assert({size: 20, address: { state: 'VA' }} === {});
```

would generate the error:

**Code: Sample structure of validation error**
```typescript
AssertionError(
  message="{size: 20, address: {state: 'VA' }} should deeply strictly equal {}"
)
```

The equivalences for the assertion operations are:

* `assert(a == b)` as `assert.equal(a, b)`
* `assert(a !== b)` as `assert.notEqual(a, b)`
* `assert(a === b)` as `assert.strictEqual(a, b)`
* `assert(a !== b)` as `assert.notStrictEqual(a, b)`
* `assert(a >= b)` as `assert.greaterThanEqual(a, b)`
* `assert(a > b)` as `assert.greaterThan(a, b)`
* `assert(a <= b)` as `assert.lessThanEqual(a, b)`
* `assert(a < b)` as `assert.lessThan(a, b)`
* `assert(a instanceof b)` as `assert.instanceOf(a, b)`
* `assert(a.includes(b))` as `assert.ok(a.includes(b))`
* `assert(/a/.test(b))` as `assert.ok(/a/.test(b))`

In addition to the standard operations, there is support for throwing/rejecting errors (or the inverse).  This is useful for testing error states or ensuring errors do not occur.  
* `throws`/`doesNotThrow` is for catching synchronous rejections

**Code: Throws vs Does Not Throw**
```typescript
assert.throws(() => {
  throw new Error();
});

assert.doesNotThrow(() => {
  let a = 5;
});
```

* `rejects`/`doesNotReject` is for catching asynchronous rejections

**Code: Reject vs Does Not Reject**
```typescript
await assert.rejects(async () => {
  throw new Error();
});

await assert.doesNotReject(async () => {
  let a = 5;
});
```

Additionally, the `throws`/`rejects` assertions take in a secondary parameter to allow for specification of the type of error expected.  This can be:
* A regular expression or string to match against the error's message
* A class to ensure the returned error is an instance of the class passed in
* A function to allow for whatever custom verification of the error is needed

**Code: Example of different Error matching paradigms** 
```typescript
assert.throws(() => {
  throw new Error('Big Error');
}, 'Big Error');

assert.throws(() => {
  throw new Error('Big Error');
}, /B.*Error/);

assert.throws(() => {
  throw new Error('Big Error');
}, Error);

assert.throws(() => {
  throw new Error('Big Error');
}, (err: any) => {
  return err.message.startsWith('Big') && err.message.length > 4 ? undefined : err;
});
```
