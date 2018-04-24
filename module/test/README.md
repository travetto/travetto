travetto: Test
===

This is a custom framework for testing, that produces `TAP` output, it also directly integrates with the `test-plugin` to provide
realtime feedback durring development.  It is a declarative framework, relying on decorators to define tests and suites.

Test suites are generally defined by the `@Suite` annotation, and tests are defined as methods on the class, using the `@Test` annotation.

```typescript test.ts
@Suite()
class SimpleTest {

  @Test()
  async test1() {
    let val = await doLongOp();s
    assert(val === 5);
  }

  @Test()
  test2() {
    assert(/abc/.test(text));
  }

}
```

Additionaly, the code utilizes AST transformations to:
- Record line number data finding tests by line number
- Translate `assert` calls into a richer format to provide better feedback, and to allow for emitting `assert` for recording results.

All tests are required to be in `test/` given how the code searching operates.