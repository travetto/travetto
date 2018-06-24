travetto: Log
===

This module provides logging functionality relying up the built in ```console``` operations. This is achieved via AST transformations. The code is rewritten at compile time to transform the `console` operations into proper logging commands. In addition to the transformation, class name and line number are added to the log messages to provide additional context.

The supported operations are:
* `console.fatal` which logs at the `FATAL` level
* `console.error` which logs at the `ERROR` level
* `console.warn` which logs at the `WARN` level
* `console.info` which logs at the `INFO` level
* `console.debug` which logs at the `DEBUG` level
* `console.trace` which logs at the `TRACE` level
* `console.log` which logs at the `INFO` level

**Note:** In production mode, all `console.debug` and `console.trace` invocations are compiled away for performance/security reasons. This means that the code is actually removed, and will not execute.

A sample of the transformation would be:
```typescript
function work() {
  console.trace('Start Work');
  ...
  try {
    ... bad invocation ...
  } catch (e) {
    console.error(e);
  }
  console.trace('End Work');
}
```
Which, when in *dev* mode transforms into:
```typescript
function work() {
  Logger.log('trace', 'Start Work');
  try {
    ... bad invocation ...
  } catch (e) { 
    Logger.log('error', e);
  }
  Logger.log('trace', 'End Work');
}
```
And when in *prod* mode transforms into:
```typescript
function work() {
  try {
    ... bad invocation ...
  } catch (e) { 
    Logger.log('error', e);
  }
}
```

The logging output, as indicated provides context for location of invocation. Given the file `test/simple.ts`:
```typescript
console.log('Hello World');

console.log('Woah!', { a: { b: { c: { d: 10 } } } });

console.info('Woah!');

console.debug('Test');

console.fatal('hi');
```
The corresponding output would be
```output
2018-06-23T16:57:58 info  [test.simple:  5] Hello World
2018-06-23T16:57:58 info  [test.simple:  7] Woah! { a: { b: { c: [Object] } } }
2018-06-23T16:57:58 info  [test.simple:  9] Woah!
2018-06-23T16:57:58 debug [test.simple: 11] Test
2018-06-23T16:57:58 fatal [test.simple: 13] hi
```